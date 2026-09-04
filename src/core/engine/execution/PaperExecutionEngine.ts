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

      // CLEANUP ORPHANS ON RECOVERY: Delete ephemeral records for this correlationId to allow safe retry
      await supabase.from('active_orders').delete().eq('correlation_id', event.trace.correlationId);
      const orphanClientOrderId = `PAPER-${event.robotId.substring(0,8)}-${event.eventId.substring(0,8)}`;
      const orphanCloseClientOrderId = `PAPER-CLS-${event.robotId.substring(0,8)}-${event.eventId.substring(0,8)}`;
      await supabase.from('execution_intents').delete().in('client_order_id', [orphanClientOrderId, orphanCloseClientOrderId]);
      
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
          const { data: existingPos } = await supabase.from('active_positions').select('*').eq('robot_id', event.robotId).limit(1).maybeSingle();
          if (existingPos) {
              const closeAction = existingPos.side === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT';
              const closeClientOrderId = `PAPER-CLS-${event.robotId.substring(0,8)}-${event.eventId.substring(0,8)}`;
              
              const { data: closeIntentData } = await supabase.from('execution_intents').insert({
                robot_id: event.robotId,
                signal_id: `${event.eventId}-CLS`,
                client_order_id: closeClientOrderId,
                action: closeAction,
                symbol: event.executionSymbol,
                order_type: 'MARKET',
                quantity: existingPos.quantity,
                price: event.entryReferencePrice,
                leverage: existingPos.leverage,
                status: 'FILLED'
              }).select('id').single();

              if (closeIntentData) {
                  await supabase.from('active_orders').insert({
                    intent_id: closeIntentData.id,
                    robot_id: event.robotId,
                    binance_order_id: `MOCK-BINANCE-${closeClientOrderId}`,
                    client_order_id: closeClientOrderId,
                    symbol: event.executionSymbol,
                    side: existingPos.side === 'LONG' ? 'SELL' : 'BUY',
                    order_type: 'MARKET',
                    quantity: existingPos.quantity,
                    price: event.entryReferencePrice,
                    filled_quantity: existingPos.quantity,
                    average_fill_price: event.entryReferencePrice,
                    status: 'FILLED',
                    role: 'TAKER',
                  correlation_id: event.trace.correlationId
                  });
              }

              const pnl = (existingPos.side === 'LONG' ? 1 : -1) * (event.entryReferencePrice - existingPos.entry_price) * existingPos.quantity;
              const ctx = existingPos.context_snapshot || {};
              const { error: thErr } = await supabase.from('trade_history').insert({
                  robot_id: event.robotId,
                  side: existingPos.side,
                  size: existingPos.quantity,
                  entry_price: existingPos.entry_price,
                  exit_price: event.entryReferencePrice,
                  realized_pnl: pnl,
                  fee: 0,
                  slippage: 0,
                  duration_seconds: 0,
                  close_reason: (event as any).closeReason || 'STOP_LOSS',
                  symbol: existingPos.symbol,
                  correlation_id: event.trace.correlationId
              });
              if (thErr) console.error('[PaperExecutionEngine] STOP/CLOSE trade_history insert failed:', thErr);

              await supabase.from('active_positions').delete().eq('id', existingPos.id);
              if (closeIntentData) {
                  await supabase.from('active_orders').delete().eq('intent_id', closeIntentData.id);
                  await supabase.from('execution_intents').delete().eq('id', closeIntentData.id);
              }
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
          
          // 1. Insert CLOSE intent
          const closeAction = existingPos.side === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT';
          const closeClientOrderId = `PAPER-CLS-${event.robotId.substring(0,8)}-${event.eventId.substring(0,8)}`;
          
          const { data: closeIntentData } = await supabase.from('execution_intents').insert({
            robot_id: event.robotId,
            signal_id: `${event.eventId}-CLS`,
            client_order_id: closeClientOrderId,
            action: closeAction,
            symbol: event.executionSymbol,
            order_type: 'MARKET',
            quantity: existingPos.quantity,
            price: event.entryReferencePrice,
            leverage: existingPos.leverage,
            status: 'FILLED'
          }).select('id').single();

          if (closeIntentData) {
              // 2. Insert CLOSE active_order
              await supabase.from('active_orders').insert({
                intent_id: closeIntentData.id,
                robot_id: event.robotId,
                binance_order_id: `MOCK-BINANCE-${closeClientOrderId}`,
                client_order_id: closeClientOrderId,
                symbol: event.executionSymbol,
                side: existingPos.side === 'LONG' ? 'SELL' : 'BUY',
                order_type: 'MARKET',
                quantity: existingPos.quantity,
                price: event.entryReferencePrice,
                filled_quantity: existingPos.quantity,
                average_fill_price: event.entryReferencePrice,
                status: 'FILLED',
                role: 'TAKER',
                  correlation_id: event.trace.correlationId
              });
          }

          // 3. Move active_position to trade_history
          const pnl = (existingPos.side === 'LONG' ? 1 : -1) * (event.entryReferencePrice - existingPos.entry_price) * existingPos.quantity;
          const ctx = existingPos.context_snapshot || {};
            const { error: histErr } = await supabase.from('trade_history').insert({
                robot_id: event.robotId,
                side: existingPos.side,
                size: existingPos.quantity,
                entry_price: existingPos.entry_price,
                exit_price: event.entryReferencePrice,
                realized_pnl: pnl,
                fee: 0,
                slippage: 0,
                duration_seconds: 0,
                close_reason: 'REVERSAL',
                symbol: existingPos.symbol,
                correlation_id: event.trace.correlationId
            });
          if (histErr) console.error('[PaperExecutionEngine] REVERSAL trade_history insert failed:', histErr);

          // 4. Delete active_position and close intent/order (Cleanup LIVE records)
          await supabase.from('active_positions').delete().eq('id', existingPos.id);
          
          if (closeIntentData) {
              await supabase.from('active_orders').delete().eq('intent_id', closeIntentData.id);
              await supabase.from('execution_intents').delete().eq('id', closeIntentData.id);
          }

          const trace = EventFactory.createTrace(event.trace.correlationId, event.eventId, this.engineId, event.trace.sequence);
          const closedEvent = EventFactory.createEvent('POSITION_CLOSED_EVENT', event.robotId, event.configVersion || 1, trace, {
            symbol: event.executionSymbol,
            side: existingPos.side,
            quantity: existingPos.quantity,
            exitPrice: event.entryReferencePrice,
            realizedPnl: pnl
          });
          await coreEventBus.publish(closedEvent as any);
          console.log(`[PAPER] EXECUTION_SUCCESS TEST_ID=${event.trace.correlationId} position closed`);
        }
      }

      // 2. Insert OPEN execution_intents
      const clientOrderId = `PAPER-${event.robotId.substring(0,8)}-${event.eventId.substring(0,8)}`;
      const { data: intentData, error: intentErr } = await supabase
        .from('execution_intents')
        .insert({
          robot_id: event.robotId,
          signal_id: event.eventId,
          client_order_id: clientOrderId,
          action: action,
          symbol: event.executionSymbol,
          order_type: event.orderType || 'MARKET',
          quantity: event.positionSize,
          price: event.entryReferencePrice,
          leverage: event.leverage,
          status: 'FILLED'
        })
        .select('id')
        .single();

      if (intentErr) {
        console.error('[PaperExecutionEngine] intentErr:', intentErr);
        if (intentErr.code === '23505') return; // Duplicate
        return;
      }
      const intentId = intentData.id;

      // 3. Insert OPEN active_orders
      const binanceOrderId = `MOCK-BINANCE-${clientOrderId}`;
      const { data: orderData, error: orderErr } = await supabase
        .from('active_orders')
        .insert({
          intent_id: intentId,
          robot_id: event.robotId,
          binance_order_id: binanceOrderId,
          client_order_id: clientOrderId,
          symbol: event.executionSymbol,
          side: side,
          order_type: event.orderType || 'MARKET',
          quantity: event.positionSize,
          price: event.entryReferencePrice,
          filled_quantity: event.positionSize,
          average_fill_price: event.entryReferencePrice,
          status: 'FILLED',
          role: 'TAKER',
                  correlation_id: event.trace.correlationId
        })
        .select('id')
        .single();

      if (orderErr) {
        console.error('[PaperExecutionEngine] orderErr:', orderErr);
        await supabase.from('execution_intents').delete().eq('id', intentId);
        return;
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
        await supabase.from('active_orders').delete().eq('id', orderData.id);
        await supabase.from('execution_intents').delete().eq('id', intentId);
        return;
      }

      // 5. Cleanup LIVE records (FILLED orders/intents are no longer LIVE)
      await supabase.from('active_orders').delete().eq('id', orderData.id);
      await supabase.from('execution_intents').delete().eq('id', intentId);

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
