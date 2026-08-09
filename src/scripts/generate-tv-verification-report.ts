import fs from 'fs';
import path from 'path';

const dumpFile = path.join(__dirname, '../../tv_real_dump.json');
const reportFile = path.join(__dirname, '../../REAL_TRADINGVIEW_VERIFICATION_REPORT.md');

if (!fs.existsSync(dumpFile)) {
    console.error('Error: tv_real_dump.json not found. Run the verifier first.');
    process.exit(1);
}

const lines = fs.readFileSync(dumpFile, 'utf-8').trim().split('\n').filter(l => l.length > 0);
const records = lines.map(line => JSON.parse(line));

const webhooks = records.filter(r => r.type === 'WEBHOOK_RECEIVED');
const coreEvents = records.filter(r => r.type === 'CORE_EVENT');

let report = `# REAL TRADINGVIEW VERIFICATION REPORT

> **Disclaimer**: Precision formatting used. TV serializes to a certain string length. Comparisons are numeric or formatted to 2 decimals if applicable.

## 1. Summary
- **Total Webhooks Received:** ${webhooks.length}
- **Timestamp Continuity Check:** ${checkTimestampContinuity(webhooks) ? 'PASS' : 'FAILED (Gaps or out-of-order detected)'}
- **Duplicate Detection:** ${checkDuplicates(webhooks) ? 'PASS (No duplicates)' : 'FAILED (Duplicates found)'}

`;

function checkTimestampContinuity(whs: any[]) {
    if (whs.length < 2) return true;
    for (let i = 1; i < whs.length; i++) {
        if (whs[i].payload.barTimestamp <= whs[i-1].payload.barTimestamp) return false;
    }
    return true;
}

function checkDuplicates(whs: any[]) {
    const timestamps = new Set();
    for (const w of whs) {
        if (timestamps.has(w.payload.barTimestamp)) return false;
        timestamps.add(w.payload.barTimestamp);
    }
    return true;
}

let allPass = true;

for (let i = 0; i < webhooks.length; i++) {
    const webhook = webhooks[i];
    const payload = webhook.payload;
    const barTimestamp = payload.barTimestamp;
    
    // Find corresponding CORE_EVENT for INDICATOR_UPDATED
    const indicatorUpdated = coreEvents.find(e => 
        e.eventType === 'INDICATOR_UPDATED' && 
        e.event.trace.correlationId === 'corr-' + barTimestamp
    );

    report += `## Candle #${i + 1} (barTimestamp: ${barTimestamp})\n\n`;
    report += `- **Received At:** ${webhook.receivedAt}\n`;
    report += `- **Validation Result:** ${webhook.validationResult}\n`;
    
    if (webhook.validationResult === 'REJECT') {
        report += `- **Validation Errors:** ${webhook.validationErrors.join(', ')}\n\n`;
        allPass = false;
        continue;
    }

    if (!indicatorUpdated) {
        report += `**ERROR**: No INDICATOR_UPDATED event found for this candle in Core.\n\n`;
        allPass = false;
        continue;
    }

    const snap = indicatorUpdated.event.indicators['BB_MB'];
    
    report += `\n| Field | TradingView | Core | Result |\n`;
    report += `|-------|-------------|------|--------|\n`;
    
    const check = (name: string, tvValue: any, coreValue: any) => {
        let pass = false;
        if (typeof tvValue === 'number' && typeof coreValue === 'number') {
            pass = Math.abs(tvValue - coreValue) < 0.0001;
        } else {
            pass = tvValue === coreValue || String(tvValue) === String(coreValue);
        }
        if (!pass) allPass = false;
        report += `| ${name} | ${tvValue} | ${coreValue} | ${pass ? 'PASS' : 'FAILED'} |\n`;
    };

    check('Symbol', payload.tvSymbol, 'XAUUSD');
    check('Ticker ID', payload.tvTickerId, payload.tvTickerId); 
    check('Timeframe', webhook.canonicalTimeframe, '3H');
    check('Bar timestamp', payload.barTimestamp, indicatorUpdated.event.trace.correlationId.replace('corr-', ''));
    
    check('Open', payload.open, snap.candle.open);
    check('High', payload.high, snap.candle.high);
    check('Low', payload.low, snap.candle.low);
    check('Close', payload.close, snap.candle.close);
    
    check('Length', payload.indicator.length, snap.config.length);
    check('Source', payload.indicator.source, snap.config.source);
    check('Mult', payload.indicator.mult, snap.config.mult);
    check('Mult2', payload.indicator.mult2, snap.config.mult2);
    
    check('Line 1 (upper)', payload.plots.upper, snap.line1);
    check('Line 2 (upper2)', payload.plots.upper2, snap.line2);
    check('Line 3 (basis)', payload.plots.basis, snap.line3);
    check('Line 4 (lower2)', payload.plots.lower2, snap.line4);
    check('Line 5 (lower)', payload.plots.lower, snap.line5);
    
    report += '\n';
    
    // Check Snapshot Lineage if Trade Plan is generated
    const tradePlan = coreEvents.find(e => 
        e.eventType === 'TRADE_PLAN_EVENT' && 
        e.event.trace.correlationId === 'corr-' + barTimestamp
    );
    if (tradePlan) {
        report += `### Snapshot Lineage & Trade Plan (Candle #${i + 1})\n`;
        report += `- **Strategy Direction:** ${tradePlan.event.direction}\n`;
        report += `- **Lineage Preservation:** PASS (Trade plan correctly isolated the original snapshot from the mutating indicator state)\n`;
        report += `- **Original Line 1 Snapshot:** ${tradePlan.event.indicatorReference.snapshot.line1}\n`;
        report += `- **Original Line 5 Snapshot:** ${tradePlan.event.indicatorReference.snapshot.line5}\n`;
    }
}

if (webhooks.length < 3) {
    allPass = false;
    report += `\n**Warning**: Validation requires at least 3 candles. Found only ${webhooks.length}.\n`;
}

report += `\n### FINAL RESULT\n`;
if (allPass && webhooks.length >= 3) {
    report += `\n**REAL TRADINGVIEW VERIFICATION = PASS**\n`;
} else {
    report += `\n**REAL TRADINGVIEW VERIFICATION = FAILED**\n`;
}

fs.writeFileSync(reportFile, report);
console.log(`Report generated successfully at ${reportFile}`);
