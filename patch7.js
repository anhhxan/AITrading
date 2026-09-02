const fs = require('fs');
let file = 'src/core/engine/runtime/StateMachineEngine.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'private activeSignals: Map<string, StrategySignalEvent> = new Map();',
    'private activeSignals: Map<string, StrategySignalEvent> = new Map();\n  private activePositions: Map<string, any> = new Map();'
);

fs.writeFileSync(file, content);
