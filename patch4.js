const fs = require('fs');
let file = 'src/core/engine/runtime/StateMachineEngine.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'private activeSignals = new Map<string, StrategySignalEvent>();',
    'private activeSignals = new Map<string, StrategySignalEvent>();\n    private activePositions = new Map<string, { side: string, sl: number | null, tp: number | null, symbol: string }>();'
);

content = content.replace(
    'private async handlePositionOpened(event: PositionOpenedEvent) {',
    'private async handlePositionOpened(event: PositionOpenedEvent) {\n      this.activePositions.set(event.robotId, { side: event.side, sl: event.stopLoss, tp: event.takeProfit, symbol: event.symbol });'
);

content = content.replace(
    'private async handlePositionClosed(event: PositionClosedEvent) {',
    'private async handlePositionClosed(event: PositionClosedEvent) {\n      this.activePositions.delete(event.robotId);'
);

content = content.replace(
    'if (activeSignal) {',
    'if (activeSignal) {\n            if ((activeSignal as any).persistent) continue;'
);

const newRealtime = private async handleRealtimePrice(event: any) {
      if (event.price <= 0 || event.eventTimestamp <= 0) return;
      const robotId = event.robotId;
      const currentState = this.states.get(robotId);

      if (currentState === RobotState.POSITION_OPEN) {
        const pos = this.activePositions.get(robotId);
        if (pos) {
          let action = null;
          if (pos.side === 'LONG' && pos.sl && event.price <= pos.sl) action = 'CLOSE';
          if (pos.side === 'SHORT' && pos.sl && event.price >= pos.sl) action = 'CLOSE';
          if (pos.side === 'LONG' && pos.tp && event.price >= pos.tp) action = 'CLOSE';
          if (pos.side === 'SHORT' && pos.tp && event.price <= pos.tp) action = 'CLOSE';

          if (action === 'CLOSE') {
            const trace = EventFactory.createTrace(event.trace.correlationId, event.eventId, this.engineId, event.trace.sequence);
            const closeEvent = EventFactory.createEvent('TRADE_PLAN_EVENT', robotId, event.configVersion || 1, trace, {
              action: 'CLOSE',
              executionSymbol: pos.symbol,
              entryReferencePrice: event.price
            });
            await coreEventBus.publish(closeEvent as any);
          }
        }
      }
;

content = content.replace(
    /private async handleRealtimePrice\(event: any\) \{[\s\S]*?const currentState = this\.states\.get\(robotId\);/,
    newRealtime
);

fs.writeFileSync(file, content);
