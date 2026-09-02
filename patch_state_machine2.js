const fs = require('fs');
const path = 'src/core/engine/runtime/StateMachineEngine.ts';
let code = fs.readFileSync(path, 'utf8');

const targetFunctionStart = "  private async handleRealtimePrice(event: any) {";
const targetFunctionEnd = "        this.states.set(robotId, RobotState.READY_TO_ENTER);";

const startIndex = code.indexOf(targetFunctionStart);
const endIndex = code.indexOf(targetFunctionEnd, startIndex);

if (startIndex === -1 || endIndex === -1) {
    console.log("Could not find bounds");
    process.exit(1);
}

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

code = code.substring(0, startIndex) + realtimePriceNew + code.substring(endIndex + targetFunctionEnd.length);

fs.writeFileSync(path, code);
console.log('Successfully replaced handleRealtimePrice');
