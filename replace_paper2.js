const fs = require('fs');
let text = fs.readFileSync('src/core/engine/execution/PaperExecutionEngine.ts', 'utf8');
let replacementStr = fs.readFileSync('replacement.ts', 'utf8');

text = text.replace("public async handleTradePlan", replacementStr + "\n  public async handleTradePlan");

fs.writeFileSync('src/core/engine/execution/PaperExecutionEngine.ts', text);
