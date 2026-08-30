const fs = require('fs');
let file = 'src/core/engine/strategies/StrategyEngine.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'export interface StrategySignalEvent extends BaseEvent {',
    'export interface StrategySignalEvent extends BaseEvent {\n  persistent?: boolean;\n  maxTimeoutCandles?: number;\n  armBounds?: any;'
);

content = content.replace('(armBounds as any): signal.armBounds,', 'armBounds: (signal as any).armBounds,');

fs.writeFileSync(file, content);
