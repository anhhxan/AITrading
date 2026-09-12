const fs = require('fs');
let text = fs.readFileSync('src/core/engine/execution/PaperExecutionEngine.ts', 'utf8');
text = text.replace(/console\.log\\\(\\\[PaperExecutionEngine\\\] Direct Execution for signal \\:\\\ , plan\\\);/g, "console.log('[PaperExecutionEngine] Direct Execution for signal ' + signalId + ':', plan);");
fs.writeFileSync('src/core/engine/execution/PaperExecutionEngine.ts', text);
