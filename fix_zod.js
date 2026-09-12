const fs = require('fs');
let text = fs.readFileSync('src/core/contracts/EntrySignal.ts', 'utf8');
text = text.replace(/, \{\n  message: "Invalid stop_loss for the given side",\n  path: \["stop_loss"\]\n\}\)/g, ', "Invalid stop_loss for the given side")');
fs.writeFileSync('src/core/contracts/EntrySignal.ts', text);
