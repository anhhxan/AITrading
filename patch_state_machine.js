const fs = require('fs');

const path = 'src/core/engine/runtime/StateMachineEngine.ts';
let code = fs.readFileSync(path, 'utf8');

// We need to add armedSignals Map
if (!code.includes('armedSignals: Map<string, boolean>')) {
  code = code.replace(
    'private signalSystemTimestamps: Map<string, number> = new Map();',
    'private signalSystemTimestamps: Map<string, number> = new Map();\n  private armedSignals: Map<string, boolean> = new Map();'
  );
}

// Update handleSignalDetected to reset armed state
if (!code.includes('this.armedSignals.set(robotId, false);')) {
  code = code.replace(
    'this.activeSignals.set(robotId, event);',
    'this.activeSignals.set(robotId, event);\n        this.armedSignals.set(robotId, false);'
  );
}

const realtimePriceOrig = `  private async handleRealtimePrice(event: any) {
    if (event.price <= 0 || event.eventTimestamp <= 0) {
      return;
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
          if (currentPrice < armBounds.lower || currentPrice > armBounds.upper) {
              isCancelled = true;
          }
      }

      if (isCancelled) {
         this.states.set(robotId, RobotState.WAIT_SIGNAL);
         await this.persistState(robotId, RobotState.WAIT_SIGNAL);
         this.activeSignals.delete(robotId);
         this.signalSystemTimestamps.delete(robotId);
         
         try {
             const { getSupabaseAdmin } = require('../../../lib/supabase');
             await getSupabaseAdmin().from('active_setups').delete().eq('robot_id', robotId);
         } catch(e) {}
         
         const trace = EventFactory.createTrace(activeSignal.trace.correlationId, event.eventId, this.engineId, event.trace.sequence);
         const transitionEvent = EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, event.configVersion || 1, trace, {
             previousState: RobotState.WAIT_CANDLE_B_CONFIRMATION,
             newState: RobotState.WAIT_SIGNAL,
             reason: 'CANCEL_TRIGGER_HIT',
             triggerPrice: currentPrice
         });
         await coreEventBus.publish(transitionEvent as any);
         return;
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

        this.states.set(robotId, RobotState.READY_TO_ENTER);`;

const realtimePriceNew = `  private async handleRealtimePrice(event: any) {
    if (event.price <= 0 || event.eventTimestamp <= 0) {
      return;
    }
    const robotId = event.robotId;
    const currentState = this.states.get(robotId);
    
    if (currentState === RobotState.WAIT_CANDLE_B_CONFIRMATION) {
      const activeSignal = this.activeSignals.get(robotId);
      if (!activeSignal) return;

      const currentPrice = event.price;
      const trigger = activeSignal.entryTrigger;
      const armBounds = (activeSignal as any).armBounds;
      const cancelBounds = (activeSignal as any).cancelBounds;
      
      let isCancelled = false;
      if (cancelBounds) {
          if (currentPrice < cancelBounds.lower || currentPrice > cancelBounds.upper) {
              isCancelled = true;
          }
      }

      if (isCancelled) {
         this.states.set(robotId, RobotState.WAIT_SIGNAL);
         await this.persistState(robotId, RobotState.WAIT_SIGNAL);
         this.activeSignals.delete(robotId);
         this.armedSignals.delete(robotId);
         this.signalSystemTimestamps.delete(robotId);
         
         try {
             const { getSupabaseAdmin } = require('../../../lib/supabase');
             await getSupabaseAdmin().from('active_setups').delete().eq('robot_id', robotId);
         } catch(e) {}
         
         const trace = EventFactory.createTrace(activeSignal.trace.correlationId, event.eventId, this.engineId, event.trace.sequence);
         const transitionEvent = EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, event.configVersion || 1, trace, {
             previousState: RobotState.WAIT_CANDLE_B_CONFIRMATION,
             newState: RobotState.WAIT_SIGNAL,
             reason: 'CANCEL_TRIGGER_HIT',
             triggerPrice: currentPrice
         });
         await coreEventBus.publish(transitionEvent as any);
         return;
      }

      // Check if price enters ARM ZONE
      let isArmed = this.armedSignals.get(robotId) || false;
      if (!isArmed && armBounds) {
          if (currentPrice >= armBounds.lower && currentPrice <= armBounds.upper) {
              isArmed = true;
              this.armedSignals.set(robotId, true);
              console.log(\`[StateMachineEngine] SIGNAL ARMED for \${robotId} at price \${currentPrice}\`);
          }
      }

      let isTriggered = false;
      
      // ONLY trigger if Armed
      if (isArmed && trigger) {
        if (currentPrice >= trigger.lower && currentPrice <= trigger.upper) {
          isTriggered = true;
        }
      }
      
      if (isTriggered) {
        this.armedSignals.delete(robotId);
        const trace = EventFactory.createTrace(
          activeSignal.trace.correlationId,
          event.eventId,
          this.engineId,
          event.trace.sequence + 1
        );

        this.states.set(robotId, RobotState.READY_TO_ENTER);`;

code = code.replace(realtimePriceOrig, realtimePriceNew);

// Also need to clear armedSignals on PositionClosed, RiskRejected, and Timeout
if (!code.includes('this.armedSignals.delete(robotId); // on clear')) {
    // Add cleanup on timeouts
    code = code.replace(
        'this.states.set(robotId, RobotState.WAIT_SIGNAL);\n            await this.persistState(robotId, RobotState.WAIT_SIGNAL);\n            this.signalSystemTimestamps.delete(robotId);',
        'this.states.set(robotId, RobotState.WAIT_SIGNAL);\n            await this.persistState(robotId, RobotState.WAIT_SIGNAL);\n            this.signalSystemTimestamps.delete(robotId);\n            this.armedSignals.delete(robotId); // on clear'
    );
}

fs.writeFileSync(path, code);
console.log('Done replacing handleRealtimePrice logic');
