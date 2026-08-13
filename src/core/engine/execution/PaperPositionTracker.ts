import { IEngine } from '../runtime/IEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { EventFactory } from '../../infrastructure/EventFactory';
import { CandleClosedEvent } from '../indicators/IndicatorEngine';

export class PaperPositionTracker implements IEngine {
  public engineId = 'PaperPositionTracker_1';
  private status: 'READY' | 'STARTING' | 'ERROR' | 'STOPPED' = 'STOPPED';
  
  private unsubs: (() => void)[] = [];

  public async initialize(): Promise<void> {
    this.status = 'STARTING';
    
    this.unsubs.push(coreEventBus.subscribe('CANDLE_CLOSED', async (e: CandleClosedEvent) => {
       await this.handleCandleClosed(e);
    }));

    this.status = 'READY';
  }

  private async handleCandleClosed(event: CandleClosedEvent) {
    const supabase = getSupabaseAdmin();
    const robotId = event.robotId;
    const candle = event.candle;

    try {
      // 1. Verify robot is in PAPER mode
      const { data: robot, error: robotErr } = await supabase
        .from('robots')
        .select('trading_mode, paper_balance')
        .eq('id', robotId)
        .single();
        
      if (robotErr || !robot) return;
      if (robot.trading_mode !== 'PAPER') return; // SAFETY: PAPER ONLY

      // 2. Query active_positions
      const { data: positions, error: posErr } = await supabase
        .from('active_positions')
        .select('*')
        .eq('robot_id', robotId);
        
      if (posErr || !positions || positions.length === 0) return;
      
      const position = positions[0]; // Assuming 1 position max per robot for now

      // 3. Evaluate TP / SL
      let isTP = false;
      let isSL = false;

      if (position.side === 'LONG') {
        if (candle.high >= position.take_profit_price) isTP = true;
        if (candle.low <= position.stop_loss_price) isSL = true;
      } else if (position.side === 'SHORT') {
        if (candle.low <= position.take_profit_price) isTP = true;
        if (candle.high >= position.stop_loss_price) isSL = true;
      }

      // 4. Handle Double-hit (AMBIGUOUS)
      if (isTP && isSL) {
        console.warn(`[PaperPositionTracker] AMBIGUOUS double-hit for ${robotId} on candle ${candle.timestamp}. Ignoring.`);
        return;
      }

      if (!isTP && !isSL) return; // No exit condition hit

      // 5. Exit condition met
      const closeReason = isTP ? 'TAKE_PROFIT' : 'STOP_LOSS';
      const exitPrice = isTP ? position.take_profit_price : position.stop_loss_price;
      const quantity = position.quantity;
      const entryPrice = position.entry_price;

      // 6. Compute P&L
      let realizedPnl = 0;
      if (position.side === 'LONG') {
        realizedPnl = (exitPrice - entryPrice) * quantity;
      } else if (position.side === 'SHORT') {
        realizedPnl = (entryPrice - exitPrice) * quantity;
      }
      
      const newBalance = Number(robot.paper_balance) + realizedPnl;

      // 7. Execute Atomicity / Compensating actions
      // A. Delete active_position
      const { error: delErr } = await supabase
        .from('active_positions')
        .delete()
        .eq('id', position.id);

      if (delErr) {
        console.error(`[PaperPositionTracker] Failed to delete position ${position.id}:`, delErr);
        return; // Stop here, idempotency is preserved since position remains
      }

      // B. Insert trade_history
      const { error: histErr } = await supabase
        .from('trade_history')
        .insert({
          robot_id: robotId,
          action: position.side === 'LONG' ? 'SELL' : 'BUY',
          side: position.side,
          entry_price: entryPrice,
          exit_price: exitPrice,
          amount: quantity,
          pnl: realizedPnl,
          fee: 0,
          slippage: 0,
          reason: closeReason
        });

      if (histErr) {
         console.error(`[PaperPositionTracker] Failed to insert trade_history for ${robotId}:`, histErr);
         // Position was deleted but history failed. In a true transactional DB we'd rollback.
         // Without RPC, we just log. The position is closed.
      }

      // C. Update paper_balance
      const { error: balErr } = await supabase
        .from('robots')
        .update({ paper_balance: newBalance })
        .eq('id', robotId);
        
      if (balErr) {
        console.error(`[PaperPositionTracker] Failed to update paper_balance for ${robotId}:`, balErr);
      }

      // 8. Publish POSITION_CLOSED_EVENT
      const trace = EventFactory.createTrace(
        event.trace.correlationId,
        event.eventId,
        this.engineId,
        event.trace.sequence
      );

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
        console.error('[PaperPositionTracker] EXCEPTION:', e.message);
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
