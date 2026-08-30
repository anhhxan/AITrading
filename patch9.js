const fs = require('fs');
let file = 'src/core/interfaces/EventInterfaces.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'export interface StrategySignalEvent extends BaseEvent {',
    'export interface StrategySignalEvent extends BaseEvent {\n  persistent?: boolean;\n  maxTimeoutCandles?: number;\n  armBounds?: any;'
);

fs.writeFileSync(file, content);
