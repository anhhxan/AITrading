const fs = require('fs');

// Fix 1: Add entry_type to phase1 and phase2 test files
for (const file of ['src/core/__tests__/phase1/webhook_direct.test.ts', 'src/core/__tests__/phase2/direct_entry.test.ts', 'src/core/__tests__/phase1/entry_signal.test.ts']) {
    let text = fs.readFileSync(file, 'utf8');
    text = text.replace(/side: 'LONG', entry_price:/g, "side: 'LONG', entry_type: 'MARKET', entry_price:");
    text = text.replace(/side: 'SHORT', entry_price:/g, "side: 'SHORT', entry_type: 'MARKET', entry_price:");
    fs.writeFileSync(file, text);
}

// Fix 2: Check PaperExecutionEngine.ts to ensure method exists
let pe = fs.readFileSync('src/core/engine/execution/PaperExecutionEngine.ts', 'utf8');
if (!pe.includes('executeDirectTradePlan')) {
    pe = pe.replace('public async handleTradePlan(event: TradePlanEvent) {', 
    "public async executeDirectTradePlan(plan: any, signalId: string): Promise<{ status: string, orderId?: string, fillPrice?: number }> {\n  console.log('[PaperExecutionEngine] Direct Execution for signal ' + signalId + ':', plan);\n  return { status: 'EXECUTED', orderId: 'paper_' + signalId, fillPrice: plan.triggerPrice };\n}\n\npublic async handleTradePlan(event: TradePlanEvent) {");
    fs.writeFileSync('src/core/engine/execution/PaperExecutionEngine.ts', pe);
}

// Fix 3: Fix HttpServer ZodError errors
let http = fs.readFileSync('src/worker/HttpServer.ts', 'utf8');
http = http.replace(/validation\.error\.errors/g, 'validation.error.issues');
fs.writeFileSync('src/worker/HttpServer.ts', http);

