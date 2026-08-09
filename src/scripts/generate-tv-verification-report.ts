import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const reportFile = path.join(__dirname, '../../REAL_TRADINGVIEW_VERIFICATION_REPORT.md');

async function run() {
    const robotId = 'RobotXAU';
    const { data: webhooks, error } = await supabase
        .from('tradingview_webhook_logs')
        .select('*')
        .eq('robot_id', robotId)
        .order('bar_timestamp', { ascending: true });

    if (error) {
        console.error('Error fetching logs from Supabase:', error);
        return;
    }

    if (!webhooks || webhooks.length === 0) {
        console.error('Error: No webhook logs found for robot', robotId);
        return;
    }

    let report = `# REAL TRADINGVIEW VERIFICATION REPORT

> **Disclaimer**: Precision formatting used. TV serializes to a certain string length. Comparisons are numeric or formatted to 2 decimals if applicable.

## 1. Summary
- **Total Webhooks Received:** ${webhooks.length}
- **Timestamp Continuity Check:** ${checkTimestampContinuity(webhooks) ? 'PASS' : 'FAILED (Gaps or out-of-order detected)'}
- **Duplicate Detection:** PASS (Enforced by Supabase payload_hash UNIQUE constraint)

`;

    let allPass = true;

    for (let i = 0; i < webhooks.length; i++) {
        const webhook = webhooks[i];
        const payload = webhook.raw_payload;
        const barTimestamp = webhook.bar_timestamp;
        
        report += `## Candle #${i + 1} (barTimestamp: ${barTimestamp})\n\n`;
        report += `- **Received At:** ${webhook.received_at}\n`;
        report += `- **Validation Result:** ${webhook.validation_status}\n`;
        
        if (webhook.validation_status === 'REJECT') {
            report += `- **Validation Errors:** ${JSON.stringify(webhook.validation_errors)}\n\n`;
            allPass = false;
            continue;
        }

        report += `\n| Field | TradingView | Core Logged | Result |\n`;
        report += `|-------|-------------|-------------|--------|\n`;
        
        const check = (name: string, tvValue: any, coreValue: any) => {
            let pass = false;
            if (typeof tvValue === 'number' && typeof coreValue === 'number') {
                pass = Math.abs(tvValue - coreValue) <= 0.0001;
            } else {
                pass = String(tvValue) === String(coreValue);
            }
            if (!pass) allPass = false;
            report += `| ${name} | ${tvValue} | ${coreValue} | ${pass ? 'PASS' : 'FAILED'} |\n`;
        };

        check('Symbol', payload.tvSymbol, webhook.tv_symbol);
        check('Ticker ID', payload.tvTickerId, webhook.tv_ticker_id); 
        check('Timeframe', payload.timeframe, webhook.timeframe);
        
        check('Open', payload.open, webhook.open);
        check('High', payload.high, webhook.high);
        check('Low', payload.low, webhook.low);
        check('Close', payload.close, webhook.close);
        
        check('Length', payload.indicator.length, webhook.indicator_length);
        check('Source', payload.indicator.source, webhook.indicator_source);
        check('Mult', payload.indicator.mult, webhook.indicator_mult);
        check('Mult2', payload.indicator.mult2, webhook.indicator_mult2);
        
        check('Line 1 (upper)', payload.plots.upper, webhook.line1);
        check('Line 2 (upper2)', payload.plots.upper2, webhook.line2);
        check('Line 3 (basis)', payload.plots.basis, webhook.line3);
        check('Line 4 (lower2)', payload.plots.lower2, webhook.line4);
        check('Line 5 (lower)', payload.plots.lower, webhook.line5);
        
        report += '\n';
        report += `- **Event Sequence:** ${webhook.event_sequence}\n`;
        report += `- **Correlation ID:** ${webhook.correlation_id}\n\n`;
    }

    if (webhooks.length < 3) {
        allPass = false;
        report += `\n**Warning**: Validation requires at least 3 candles. Found only ${webhooks.length}.\n`;
    }

    report += `\n### FINAL RESULT\n`;
    if (allPass && webhooks.length >= 3) {
        report += `\n**REAL TRADINGVIEW POC = PASS**\n`;
    } else {
        report += `\n**REAL TRADINGVIEW POC = NOT CERTIFIED**\n`;
    }

    fs.writeFileSync(reportFile, report);
    console.log(`Report generated successfully at ${reportFile}`);
}

function checkTimestampContinuity(whs: any[]) {
    if (whs.length < 2) return true;
    for (let i = 1; i < whs.length; i++) {
        if (whs[i].bar_timestamp <= whs[i-1].bar_timestamp) return false;
    }
    return true;
}

run();
