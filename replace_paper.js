const fs = require('fs');
let text = fs.readFileSync('src/core/engine/execution/PaperExecutionEngine.ts', 'utf8');
let replacementStr = fs.readFileSync('replacement.ts', 'utf8');

text = text.replace("import { EventFactory } from '../../infrastructure/EventFactory';", "import { EventFactory } from '../../infrastructure/EventFactory';\nimport { ExchangeRouter } from './ExchangeRouter';");
text = text.replace(/public async executeDirectTradePlan[\s\S]*?fillPrice: plan\.triggerPrice };\s*}/, replacementStr);

fs.writeFileSync('src/core/engine/execution/PaperExecutionEngine.ts', text);
