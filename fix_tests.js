const fs = require('fs');
let text = fs.readFileSync('src/core/__tests__/phase3b/execution_integration.test.ts', 'utf8');

const cleanup = 
    beforeAll(async () => {
        try {
            require('fs').unlinkSync(require('path').resolve(process.cwd(), 'idempotency.json'));
        } catch(e) {}
;

text = text.replace(/beforeAll\(async \(\) => \{/, cleanup);
fs.writeFileSync('src/core/__tests__/phase3b/execution_integration.test.ts', text);
