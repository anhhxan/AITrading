import { IEngine } from '../runtime/IEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { EventFactory } from '../../infrastructure/EventFactory';
import { CandleClosedEvent } from '../indicators/IndicatorEngine';

export class PaperPositionTracker implements IEngine {
  public engineId = 'PaperPositionTracker_1';
  private status: 'READY' | 'STARTING' | 'ERROR' | 'STOPPED' = 'STOPPED';
  
  private unsubs: (() => void)[] = [];
  
  // IMMUTABLE SNAPSHOT STATE (Position Context)
  private positionContexts: Map<string, any> = new Map();
  // IN-MEMORY ACTIVE POSITIONS
  private activePositions: Map<string, any> = new Map();

  public async initialize(): Promise<void> {
    this.status = 'STARTING';
    
    // Load existing active positions into memory on startup
    try {
      const { data: positions } = await getSupabaseAdmin().from('active_positions').select('*');
      if (positions) {
        for (const pos of positions) {
          this.activePositions.set(pos.robot_id, pos);
        }
      }
    } catch (err) {
      console.error('[PaperPositionTracker] Failed to load active positions on startup:', err);
    }

    this.unsubs.push(coreEventBus.subscribe('POSITION_OPENED_EVENT', async (e: any) => {
       // Save context securely by robot_id
       this.positionContexts.set(e.robotId, {
         executionSymbol: e.symbol,
         tradingViewSymbol: e.tradingViewSymbol,
         timeframe: e.timeframe,
         strategyId: e.strategyId,
         indicatorSnapshot: e.indicatorSnapshot
       });
       // Add to active memory tracking
       this.activePositions.set(e.robotId, {
         robot_id: e.robotId,
         symbol: e.symbol,
         side: e.side,
         quantity: e.quantity,
         entry_price: e.entryPrice,
         stop_loss_price: e.stopLoss,
         take_profit_price: e.takeProfit,
         leverage: e.leverage
       });
    }));

    // Listen to REALTIME prices for SL/TP evaluation
    this.unsubs.push(coreEventBus.subscribe('REALTIME_PRICE_EVENT', async (e: any) => {
       await this.handleRealtimePrice(e);
    }));

    this.status = 'READY';
  }

  private async handleRealtimePrice(event: any) {
    if (event.price <= 0 || event.eventTimestamp <= 0) return;
    const robotId = event.robotId;
    
    const position = this.activePositions.get(robotId);
    if (!position) return; // No active position

    const currentPrice = event.price;
    let isTP = false;
    let isSL = false;

    if (position.side === 'LONG') {
      if (currentPrice >= position.take_profit_price) isTP = true;
      if (currentPrice <= position.stop_loss_price) isSL = true;
    } else if (position.side === 'SHORT') {
      if (currentPrice <= position.take_profit_price) isTP = true;
      if (currentPrice >= position.stop_loss_price) isSL = true;
    }

    if (!isTP && !isSL) return; // No exit condition hit

    // Remove from memory immediately to prevent double-processing on next tick
    this.activePositions.delete(robotId);

    const closeReason = isTP ? 'TAKE_PROFIT' : 'STOP_LOSS';
    const exitPrice = currentPrice; // Using exact trigger price
    const quantity = position.quantity;
    const entryPrice = position.entry_price;

    const supabase = getSupabaseAdmin();
    try {
      const { data: robot, error: robotErr } = await supabase
        .from('robots')
        .select('trading_mode, paper_balance')
        .eq('id', robotId)
        .single();
        
      if (robotErr || !robot) return;
      if (robot.trading_mode !== 'PAPER') return;

      // Compute P&L
      let realizedPnl = 0;
      if (position.side === 'LONG') {
        realizedPnl = (exitPrice - entryPrice) * quantity;
      } else if (position.side === 'SHORT') {
        realizedPnl = (entryPrice - exitPrice) * quantity;
      }
      
      const newBalance = Number(robot.paper_balance) + realizedPnl;

      // Delete active_position
      await supabase.from('active_positions').delete().eq('robot_id', robotId);

      // Restore snapshot context securely
      const ctx = this.positionContexts.get(robotId) || {
         executionSymbol: position.symbol || 'unknown_legacy',
         tradingViewSymbol: 'unknown_legacy',
         timeframe: 'unknown',
         strategyId: 'unknown_legacy',
         indicatorSnapshot: {}
      };

      // Insert trade_history
      await supabase.from('trade_history').insert({
          robot_id: robotId,
          action: position.side === 'LONG' ? 'SELL' : 'BUY',
          side: position.side,
          entry_price: entryPrice,
          exit_price: exitPrice,
          amount: quantity,
          pnl: realizedPnl,
          fee: 0,
          slippage: 0,
          reason: closeReason,
          execution_symbol: ctx.executionSymbol,
          trading_view_symbol: ctx.tradingViewSymbol,
          timeframe: ctx.timeframe,
          strategy_id: ctx.strategyId,
          indicator_snapshot: ctx.indicatorSnapshot
      });

      // Update paper_balance
      await supabase.from('robots').update({ paper_balance: newBalance }).eq('id', robotId);

      // Publish POSITION_CLOSED_EVENT
      const trace = EventFactory.createTrace(event.trace?.correlationId || 'sl-tp-'+Date.now(), event.eventId || 'sl-tp-id', this.engineId, Date.now());

      const closedEvent = EventFactory.createEvent(
        'POSITION_CLOSED_EVENT',
        robotId, event.configVersion || 1,
        trace,
        {
          symbol: position.symbol,
          side: position.side,
          quantity: quantity,
          exitPrice: exitPrice,
          realizedPnl: realizedPnl,
          closeReason: closeReason
        }
      );

      console.log(`[PaperPositionTracker] Position closed for ${robotId}. Reason: ${closeReason}. PNL: ${realizedPnl}`);
      await coreEventBus.publish(closedEvent as any);

    } catch (e: any) {
        console.error('[PaperPositionTracker] EXCEPTION in exit processing:', e.message);
    }
  }

  public healthCheck(): any { return { status: this.status }; }
  public ready(): boolean { return this.status === 'READY'; }
  public async shutdown(): Promise<void> {
    for (const unsub of this.unsubs) unsub();
    this.unsubs = [];
    this.status = 'STOPPED';
  }
}
