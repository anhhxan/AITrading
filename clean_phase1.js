const fs = require('fs');
let text = fs.readFileSync('src/core/__tests__/phase1/webhook_direct.test.ts', 'utf8');

text = text.replace("beforeAll(() => {", "beforeAll(() => { try { require('fs').unlinkSync(require('path').resolve(process.cwd(), 'idempotency.json')); } catch(e) {}");
fs.writeFileSync('src/core/__tests__/phase1/webhook_direct.test.ts', text);
