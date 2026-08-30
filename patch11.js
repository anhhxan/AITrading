const fs = require('fs');
let file = 'src/core/engine/strategies/StrategyEngine.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace('export interface StrategySignalEvent extends BaseEvent {\n  persistent?: boolean;\n  maxTimeoutCandles?: number;\n  armBounds?: any;\n  direction: SignalSide;\n  maxTimeoutCandles?: number;\n  persistent?: boolean;\n  entryTrigger?: { type: string, lower: number, upper: number };\n  cancelTrigger?: { type: string, value: number };\n}', 'export interface StrategySignalEvent extends BaseEvent {\n  direction: SignalSide;\n  maxTimeoutCandles?: number;\n  persistent?: boolean;\n  armBounds?: any;\n  entryTrigger?: { type: string, lower: number, upper: number };\n  cancelTrigger?: { type: string, value: number };\n}');
fs.writeFileSync(file, content);
