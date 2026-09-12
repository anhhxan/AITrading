const fs = require('fs');
let text = fs.readFileSync('src/core/__tests__/phase3b/execution_integration.test.ts', 'utf8');

text = text.replace(/console.log\(res.data\);/g, "");
text = text.replace("expect(res.data.status).toBe('ACCEPTED');", "console.log(res.data); expect(res.data.status).toBe('ACCEPTED');");

fs.writeFileSync('src/core/__tests__/phase3b/execution_integration.test.ts', text);
