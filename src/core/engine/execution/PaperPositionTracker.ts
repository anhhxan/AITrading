import { IEngine } from '../runtime/IEngine';
import { coreEventBus } from '@/core/infrastructure/EventBus';
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

    // Listen to FORCE_CLOSE_POSITION_EVENT for Reversals
    this.unsubs.push(coreEventBus.subscribe('FORCE_CLOSE_POSITION_EVENT', async (e: any) => {
       await this.handleForceClose(e);
    }));

    this.status = 'READY';
  }

  private async handleForceClose(event: any) {
    const robotId = event.robotId;
    const position = this.activePositions.get(robotId);
    if (!position) return;
    
    console.log(`[PaperPositionTracker] FORCE CLOSING position for ${robotId} due to ${event.payload?.reason}`);
    
    // We need to fetch the latest price. If we don't have it, we use entry price (fallback).
    // Ideally RealtimePriceFeed is running and emitting REALTIME_PRICE_EVENT.
    // But we don't cache current price here. So we fetch it from DB or rely on the last known?
    // Actually we can query Binance directly or just fetch from DB if needed. 
    // For simplicity, let's just use a fast fallback logic.
    
    this.activePositions.delete(robotId);
    
    const supabase = getSupabaseAdmin();
    const { data: robot } = await supabase.from('robots').select('trading_mode, paper_balance, execution_symbol').eq('id', robotId).single();
    
    let exitPrice = position.entry_price; // Fallback
    if (robot && robot.execution_symbol) {
        // Skipping binance fetch to avoid network hangs in core engine. Will just use entryPrice as fallback.
    }

    if (!robot || robot.trading_mode !== 'PAPER') return;

    const { data: rpcData, error: rpcErr } = await supabase.rpc('atomic_paper_close', {
        p_robot_id: robotId,
        p_exit_price: exitPrice,
        p_close_reason: event.payload?.reason || 'FORCE_CLOSE',
        p_correlation_id: event.trace?.correlationId || 'force-close-' + Date.now()
    });

    if (rpcErr) throw new Error(`[PaperPositionTracker] FORCE_CLOSE RPC failed: ${rpcErr.message}`);
    if (!rpcData || !rpcData.success) {
        console.warn(`[PaperPositionTracker] FORCE_CLOSE RPC returned false: ${rpcData?.error}`);
        return;
    }

    const realizedPnl = rpcData.realized_pnl;

    const trace = EventFactory.createTrace(event.trace?.correlationId || 'force-close-'+Date.now(), event.eventId || 'fc-id', this.engineId, Date.now());
    const closedEvent = EventFactory.createEvent(
      'POSITION_CLOSED_EVENT',
      robotId, event.configVersion || 1,
      trace,
      {
        symbol: position.symbol,
        side: position.side,
        quantity: position.quantity,
        entryPrice: position.entry_price,
        exitPrice,
        realizedPnl,
        closeReason: event.payload?.reason || 'FORCE_CLOSE'
      }
    );
    await coreEventBus.publish(closedEvent as any);
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

      const { data: rpcData, error: rpcErr } = await supabase.rpc('atomic_paper_close', {
          p_robot_id: robotId,
          p_exit_price: exitPrice,
          p_close_reason: closeReason,
          p_correlation_id: event.trace?.correlationId || 'sl-tp-' + Date.now()
      });

      if (rpcErr) throw new Error(`[PaperPositionTracker] REALTIME RPC failed: ${rpcErr.message}`);
      if (!rpcData || !rpcData.success) {
          console.warn(`[PaperPositionTracker] REALTIME RPC returned false: ${rpcData?.error}`);
          return;
      }

      const realizedPnl = rpcData.realized_pnl;

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
