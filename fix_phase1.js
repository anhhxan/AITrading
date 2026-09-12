const fs = require('fs');
let text = fs.readFileSync('src/core/__tests__/phase1/webhook_direct.test.ts', 'utf8');

text = text.replace("const mockRuntimeManager: any = {};", "const mockRuntimeManager: any = { riskEngine: { evaluateDirectEntry: async () => ({ decision: 'ACCEPTED', tradePlan: {} }) }, executionEngine: { executeDirectTradePlan: async () => ({ status: 'EXECUTED', fillPrice: 60000 }) } };");
fs.writeFileSync('src/core/__tests__/phase1/webhook_direct.test.ts', text);
