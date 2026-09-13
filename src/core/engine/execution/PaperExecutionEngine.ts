import { IEngine } from '../runtime/IEngine';
import { coreEventBus } from '@/core/infrastructure/EventBus';
import { TradePlanEvent } from '../risk/RiskEngine';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { EventFactory } from '../../infrastructure/EventFactory';

export class PaperExecutionEngine implements IEngine {
  public engineId = 'PaperExecutionEngine_1';
  private status: 'READY' | 'STARTING' | 'ERROR' | 'STOPPED' = 'STOPPED';
  
  private unsubs: (() => void)[] = [];

  public async initialize(): Promise<void> {
    this.status = 'STARTING';
    
    this.unsubs.push(coreEventBus.subscribe('TRADE_PLAN_EVENT', async (e: TradePlanEvent) => {
       await this.handleTradePlan(e);
    }));

    this.status = 'READY';
  }

  public async handleTradePlan(event: TradePlanEvent) {
    console.log(`[PAPER] EXECUTION_STARTED TEST_ID=${event.trace.correlationId} robot=${event.robotId}`);
    console.log(`[PAPER] EVENT PAYLOAD:`, JSON.stringify(event, null, 2));
    const supabase = getSupabaseAdmin();
    let lockAcquired = false;
    try {
      // --- PHASE 3.13H.2: CRASH-SAFE EXECUTION ATOMICITY ---
      const { data: _lockAcq, error: lockErr } = await supabase.rpc('acquire_execution_lock', { p_correlation_id: event.trace.correlationId });
      lockAcquired = _lockAcq || false;
      
      if (lockErr || !lockAcquired) {
          console.log(`[PaperExecutionEngine] IDEMPOTENCY_SKIP: Lock not acquired (Already COMPLETED or currently EXECUTING) for correlationId=${event.trace.correlationId}`);
          return;
      }
      // -----------------------------------------------------
const markCompleted = async (cid: string) => {
          if (lockAcquired) {
              await supabase.from('idempotency_keys').update({ status: 'COMPLETED', updated_at: new Date().toISOString() }).eq('key_id', cid);
          }
      };

      // CLEANUP ORPHANS ON RECOVERY removed as execution_intents and active_orders are no longer used for Paper.
      
      const { data: robot, error: robotErr } = await supabase

        .from('robots')
        .select('trading_mode, trading_enabled, status')
        .eq('id', event.robotId)
        .single();
        
      if (robotErr || !robot) {
        console.log(`[PAPER] EXECUTION_SKIPPED TEST_ID=${event.trace.correlationId} reason=ROBOT_NOT_FOUND`);
        return;
      }
      if (robot.trading_mode === 'LIVE') {
        throw new Error('FATAL: Cannot execute LIVE orders.');
      }
      if (robot.trading_mode !== 'PAPER') {
        console.log(`[PAPER] EXECUTION_SKIPPED TEST_ID=${event.trace.correlationId} reason=NOT_PAPER_MODE`);
        return;
      }

      if ((event as any).action === 'CLOSE') {
          console.log(`[PaperExecutionEngine] STOP/CLOSE DETECTED for robot ${event.robotId}`);
          const consoleReason = (event as any).closeReason || 'STOP_LOSS';
          const { data: rpcData, error: rpcErr } = await supabase.rpc('atomic_paper_close', {
              p_robot_id: event.robotId,
              p_exit_price: event.entryReferencePrice,
              p_close_reason: consoleReason,
              p_correlation_id: event.trace.correlationId
          });
          
          if (rpcErr) {
              console.error('[PaperExecutionEngine] STOP/CLOSE RPC failed:', rpcErr);
          } else if (!rpcData || !rpcData.success) {
              console.warn(`[PaperExecutionEngine] STOP/CLOSE RPC returned false: ${rpcData?.error}`);
          } else {
              console.log(`[PAPER] EXECUTION_SUCCESS TEST_ID=${event.trace.correlationId} position closed`);
          }
          return;
      }

      const side = event.direction === 'LONG' ? 'BUY' : 'SELL';
      const action = event.direction === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT';
      const positionSide = event.direction; 
      
      if (!event.entryReferencePrice || event.entryReferencePrice <= 0) {
        console.log(`[PAPER] EXECUTION_REJECTED TEST_ID=${event.trace.correlationId} reason=INVALID_PRICE`);
        return;
      }

      const { data: existingPos } = await supabase
        .from('active_positions')
        .select('*')
        .eq('robot_id', event.robotId)
        .limit(1)
        .maybeSingle();

      if (existingPos) {
        if (existingPos.side === positionSide) {
          console.log(`[PAPER] EXECUTION_REJECTED TEST_ID=${event.trace.correlationId} reason=POSITION_ALREADY_OPEN robot=${event.robotId}`);
          return;
        } else {
          console.log(`[PaperExecutionEngine] REVERSAL DETECTED for robot ${event.robotId}. Closing existing position.`);
          
          const { data: rpcData, error: rpcErr } = await supabase.rpc('atomic_paper_close', {
              p_robot_id: event.robotId,
              p_exit_price: event.entryReferencePrice,
              p_close_reason: 'REVERSAL',
              p_correlation_id: event.trace.correlationId
          });

          if (rpcErr) {
              console.error('[PaperExecutionEngine] REVERSAL RPC failed:', rpcErr);
          } else if (!rpcData || !rpcData.success) {
              console.warn(`[PaperExecutionEngine] REVERSAL RPC returned false: ${rpcData?.error}`);
          }
          
          const realizedPnl = rpcData?.realized_pnl || 0;

          const trace = EventFactory.createTrace(event.trace.correlationId, event.eventId, this.engineId, event.trace.sequence);
          const closedEvent = EventFactory.createEvent('POSITION_CLOSED_EVENT', event.robotId, event.configVersion || 1, trace, {
            symbol: event.executionSymbol,
            side: existingPos.side,
            quantity: existingPos.quantity,
            exitPrice: event.entryReferencePrice,
            realizedPnl: realizedPnl
          });
          await coreEventBus.publish(closedEvent as any);
          console.log(`[PAPER] EXECUTION_SUCCESS TEST_ID=${event.trace.correlationId} position closed`);
        }
      }

      // 4. Insert active_positions
      const { error: posErr } = await supabase
        .from('active_positions')
        .insert({
          robot_id: event.robotId,
          symbol: event.executionSymbol,
          side: positionSide,
          quantity: event.positionSize,
          entry_price: event.entryReferencePrice,
          leverage: event.leverage,
          unrealized_pnl: 0,
          realized_pnl: 0,
          stop_loss_price: event.stopLoss,
          take_profit_price: event.takeProfit,
          correlation_id: event.trace.correlationId,
          context_snapshot: {
            executionSymbol: event.executionSymbol,
            tradingViewSymbol: event.tradingViewSymbol,
            timeframe: event.timeframe,
            strategyId: event.strategyId,
            indicatorSnapshot: event.indicatorReference
          }
        });

      if (posErr) {
        console.error('[PaperExecutionEngine] posErr:', posErr);
        return;
      }

      // 6. Publish POSITION_OPENED_EVENT
      const trace = EventFactory.createTrace(event.trace.correlationId, event.eventId, this.engineId, event.trace.sequence);
      const openedEvent = EventFactory.createEvent('POSITION_OPENED_EVENT', event.robotId, event.configVersion || 1, trace, {
        symbol: event.executionSymbol,
        tradingViewSymbol: event.tradingViewSymbol,
        timeframe: event.timeframe,
        strategyId: event.strategyId,
        indicatorSnapshot: event.indicatorReference,
        side: positionSide,
        quantity: event.positionSize,
        entryPrice: event.entryReferencePrice,
        stopLoss: event.stopLoss,
        takeProfit: event.takeProfit,
        leverage: event.leverage
      });
      await coreEventBus.publish(openedEvent as any);
      console.log(`[PAPER] EXECUTION_SUCCESS TEST_ID=${event.trace.correlationId} position opened`);
      await markCompleted(event.trace.correlationId);



} catch (e: any) {
        console.log(`[PAPER] EXECUTION_REJECTED TEST_ID=${event.trace.correlationId} error=${e.message}`);
        console.error('[PaperExecutionEngine] EXCEPTION:', e.message);
    }
  }

  
  public async closePosition(robotId: string, correlationId: string, eventId: string, exitPrice: number, closeReason: string = 'TRADINGVIEW_EXIT') {
      const supabase = getSupabaseAdmin();
      const { data: existingPos, error: checkErr } = await supabase
        .from('active_positions')
        .select('*')
        .eq('robot_id', robotId)
        .single();
        
      if (checkErr || !existingPos) {
          console.log(`[PAPER] CLOSE_IGNORED TEST_ID=${correlationId} reason=NO_OPEN_POSITION robot=${robotId}`);
          return;
      }
      
      console.log(`[PaperExecutionEngine] CLOSING position for robot ${robotId} at ${exitPrice}`);
      
      const { data: rpcData, error: rpcErr } = await supabase.rpc('atomic_paper_close', {
          p_robot_id: robotId,
          p_exit_price: exitPrice,
          p_close_reason: closeReason,
          p_correlation_id: correlationId
      });

      if (rpcErr) {
          console.error('[PaperExecutionEngine] closePosition RPC failed:', rpcErr);
          throw new Error(`RPC Failed: ${rpcErr.message}`);
      } else if (!rpcData || !rpcData.success) {
          console.warn(`[PaperExecutionEngine] closePosition RPC returned false: ${rpcData?.error}`);
      }
      
      const realizedPnl = rpcData?.realized_pnl || 0;

      const trace = EventFactory.createTrace(correlationId, eventId, this.engineId, 999);
      const closedEvent = EventFactory.createEvent('POSITION_CLOSED_EVENT', robotId, 1, trace, {
        symbol: existingPos.symbol,
        side: existingPos.side,
        quantity: existingPos.quantity,
        exitPrice: exitPrice,
        realizedPnl: realizedPnl
      });
      await coreEventBus.publish(closedEvent as any);
      console.log(`[PAPER] EXECUTION_SUCCESS TEST_ID=${correlationId} position closed`);
  }

  public healthCheck(): any {
    return { status: this.status };
  }

  public ready(): boolean { 
    return this.status === 'READY'; 
  }

  public async shutdown(): Promise<void> {
    for (const unsub of this.unsubs) unsub();
    this.unsubs = [];
    this.status = 'STOPPED';
  }
}

