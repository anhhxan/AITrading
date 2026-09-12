const fs = require('fs');
let text = fs.readFileSync('src/core/contracts/EntrySignal.ts', 'utf8');
text = text.replace(/z\.record\(z\.any\(\)\)/g, 'z.record(z.string(), z.any())');
fs.writeFileSync('src/core/contracts/EntrySignal.ts', text);
