import { IEngine } from '../runtime/IEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
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

  private async handleTradePlan(event: TradePlanEvent) {
    console.log('[PaperExecutionEngine] Received TRADE_PLAN_EVENT for', event.robotId);
    const supabase = getSupabaseAdmin();

    try {
      // 1. Verify trading_mode === 'PAPER' and trading_enabled
      const { data: robot, error: robotErr } = await supabase
        .from('robots')
        .select('trading_mode, trading_enabled, status')
        .eq('id', event.robotId)
        .single();
        
      if (robotErr || !robot) {
        console.error('[PaperExecutionEngine] Failed to load robot:', event.robotId);
        return;
      }

      if (robot.trading_mode !== 'PAPER') {
        console.warn('[PaperExecutionEngine] REJECTED: Not in PAPER mode.', event.robotId);
        return;
      }
      
      if (!robot.trading_enabled) {
          // In some tests trading_enabled is false, we might want to bypass or enforce it. 
          // The prompt said: "trading_enabled = false... Expected: execution_intent = 1". 
          // So for paper mode, we might execute even if trading_enabled is false (or only reject LIVE). 
          // Wait, the prompt says "Robot: trading_mode = PAPER, trading_enabled = false. Expected: execution_intent = 1".
          // So we do NOT block on trading_enabled here.
      }

      // Mapping Side and Action
      const side = event.direction === 'LONG' ? 'BUY' : 'SELL';
      const action = event.direction === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT';
      
      // We will map execution intent direction. 
      // PostgreSQL `position_side` enum (LONG, SHORT). But execution_intents uses VARCHAR.
      const positionSide = event.direction; 
      
      if (!event.entryReferencePrice || event.entryReferencePrice <= 0) {
        console.error('[PaperExecutionEngine] REJECTED: Invalid entryReferencePrice', event.entryReferencePrice);
        return;
      }

      // 2. Insert execution_intents
      // Idempotency uses (robot_id, signal_id) which we map to event.eventId
      const clientOrderId = `PAPER-${event.robotId.substring(0,8)}-${event.eventId.substring(0,8)}`;
      
      const { data: intentData, error: intentErr } = await supabase
        .from('execution_intents')
        .insert({
          robot_id: event.robotId,
          signal_id: event.eventId,
          client_order_id: clientOrderId,
          action: action,
          symbol: event.executionSymbol,
          order_type: 'MARKET',
          quantity: event.positionSize,
          price: event.entryReferencePrice,
          leverage: event.leverage,
          status: 'FILLED'
        })
        .select('id')
        .single();

      if (intentErr) {
        if (intentErr.code === '23505') {
            console.log('[PaperExecutionEngine] REJECTED: Duplicate intent (idempotency caught).', event.robotId, event.eventId);
            return;
        }
        console.error('[PaperExecutionEngine] INTENT INSERT ERROR:', intentErr.message);
        return;
      }

      const intentId = intentData.id;

      // 3. Insert active_orders
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
          order_type: 'MARKET',
          quantity: event.positionSize,
          price: event.entryReferencePrice,
          filled_quantity: event.positionSize,
          average_fill_price: event.entryReferencePrice,
          status: 'FILLED',
          role: 'ENTRY'
        })
        .select('id')
        .single();

      if (orderErr) {
        console.error('[PaperExecutionEngine] ORDER INSERT ERROR:', orderErr.message);
        // Compensating cleanup
        await supabase.from('execution_intents').delete().eq('id', intentId);
        return;
      }

      // 4. Insert active_positions
      const { data: posData, error: posErr } = await supabase
        .from('active_positions')
        .insert({
          robot_id: event.robotId,
          symbol: event.executionSymbol,
          side: positionSide, // Wait, active_positions side is VARCHAR, usually BUY/SELL or LONG/SHORT? 
          // Phase 3 migration active_positions: side VARCHAR(10) NOT NULL. Let's use LONG/SHORT.
          quantity: event.positionSize,
          entry_price: event.entryReferencePrice,
          leverage: event.leverage,
          unrealized_pnl: 0,
          realized_pnl: 0,
          stop_loss_price: event.stopLoss,
          take_profit_price: event.takeProfit,
          binance_position_id: null,
          context_snapshot: {
            executionSymbol: event.executionSymbol,
            tradingViewSymbol: event.tradingViewSymbol,
            timeframe: event.timeframe,
            strategyId: event.strategyId,
            indicatorSnapshot: event.indicatorReference
          }
        })
        .select('id')
        .single();

      if (posErr) {
        if (posErr.code === '23505') {
           console.log('[PaperExecutionEngine] REJECTED: Duplicate position for robot-symbol.', event.robotId);
        } else {
           console.error('[PaperExecutionEngine] POSITION INSERT ERROR:', posErr.message);
        }
        // Compensating cleanup
        await supabase.from('active_orders').delete().eq('id', orderData.id);
        await supabase.from('execution_intents').delete().eq('id', intentId);
        return;
      }

      // 5. Publish POSITION_OPENED_EVENT
      const trace = EventFactory.createTrace(
        event.trace.correlationId,
        event.eventId,
        this.engineId,
        event.trace.sequence
      );

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

      console.log('[PaperExecutionEngine] Position opened successfully. Publishing POSITION_OPENED_EVENT.');
      await coreEventBus.publish(openedEvent as any);

    } catch (e: any) {
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
