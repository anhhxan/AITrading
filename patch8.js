const fs = require('fs');
let file = 'src/core/engine/strategies/StrategyEngine.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('armBounds: signal.armBounds,', '(armBounds as any): signal.armBounds,');

fs.writeFileSync(file, content);
