const fs = require('fs');

let code = fs.readFileSync('src/core/engine/runtime/StateMachineEngine.ts', 'utf8');

const startIdx = code.indexOf('private async handleRealtimePrice(event: any) {');
const endStr = 'private async handlePositionOpened(event: PositionOpenedEvent) {';
const endIdx = code.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = \private async handleRealtimePrice(event: any) {
    if (event.price <= 0 || event.eventTimestamp <= 0) {
      return; // ENTRY SAFETY: Ignore invalid realtime price ticks
    }
    const robotId = event.robotId;
    const currentState = this.states.get(robotId);
    
    if (currentState === RobotState.WAIT_CANDLE_B_CONFIRMATION) {
      const activeSignal = this.activeSignals.get(robotId);
      if (!activeSignal) return;

      const currentPrice = event.price;
      const trigger = activeSignal.entryTrigger;
      const armBounds = (activeSignal as any).armBounds;
      
      let isCancelled = false;
      if (armBounds) {
          // If price breaks outside the required bounds for Candle B -> CANCEL
          if (currentPrice < armBounds.lower || currentPrice > armBounds.upper) {
              isCancelled = true;
          }
      }

      if (isCancelled) {
         console.log('SETUP CANCELLED for ' + robotId + '. Price ' + currentPrice + ' went outside bounds');
         this.states.set(robotId, RobotState.WAIT_SIGNAL);
         await this.persistState(robotId, RobotState.WAIT_SIGNAL);
         this.activeSignals.delete(robotId);
         this.signalSystemTimestamps.delete(robotId);
         
         const { getSupabaseAdmin } = require('../../../lib/supabase');
         await getSupabaseAdmin().from('active_setups').delete().eq('robot_id', robotId);
         
         const trace = EventFactory.createTrace(activeSignal.trace.correlationId, event.eventId, this.engineId, event.trace.sequence);
         const transitionEvent = EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, event.configVersion || 1, trace, {
             previousState: RobotState.WAIT_CANDLE_B_CONFIRMATION,
             newState: RobotState.WAIT_SIGNAL,
             reason: 'CANCEL_TRIGGER_HIT',
             triggerPrice: currentPrice
         });
         await coreEventBus.publish(transitionEvent as any);
         return; // Setup cancelled, do not evaluate trigger
      }

      let isTriggered = false;
      
      if (trigger) {
        if (currentPrice >= trigger.lower && currentPrice <= trigger.upper) {
          isTriggered = true;
        }
      }
      
      if (isTriggered) {
        const trace = EventFactory.createTrace(
          activeSignal.trace.correlationId,
          event.eventId,
          this.engineId,
          event.trace.sequence + 1
        );

        this.states.set(robotId, RobotState.READY_TO_ENTER);
        this.timeoutCounts.set(robotId, 0); // Reset for entry timeout
        await this.persistState(robotId, RobotState.READY_TO_ENTER);

        const transitionEvent = EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, event.configVersion || 1, trace, {
          oldState: RobotState.WAIT_CANDLE_B_CONFIRMATION,
          newState: RobotState.READY_TO_ENTER,
          triggerPrice: currentPrice,
          strategyId: activeSignal.strategyId
        });

        const { getSupabaseAdmin } = require('../../../lib/supabase');
        await getSupabaseAdmin().from('active_setups').delete().eq('robot_id', robotId);

        console.log('SETUP FIRE for ' + robotId + '. Price: ' + currentPrice + '. Transitioning to READY_TO_ENTER');
        await coreEventBus.publish(transitionEvent as any);
        
        // Remove active signal because we've triggered
        this.activeSignals.delete(robotId);
      }
    }
  }

  \;
    code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
    fs.writeFileSync('src/core/engine/runtime/StateMachineEngine.ts', code);
    console.log('Replaced successfully!');
} else {
    console.log('Could not find start or end block');
}
