const fs = require('fs');
const path = require('path');
const p = path.join('src', 'core', 'adapters', 'tradingview', 'TradingViewAdapter.ts');
let content = fs.readFileSync(p, 'utf8');

const regex = /let expected_delta_ms = 60000;\s*if\s*\(payload\.timeframe === '5'\)\s*expected_delta_ms = 5 \* 60000;\s*if\s*\(payload\.timeframe === '15'\)\s*expected_delta_ms = 15 \* 60000;/m;

const replacement = `let expected_delta_ms = 60000;
    const tf = payload.timeframe;
    if (tf === '3') expected_delta_ms = 3 * 60000;
    else if (tf === '5') expected_delta_ms = 5 * 60000;
    else if (tf === '10') expected_delta_ms = 10 * 60000;
    else if (tf === '15') expected_delta_ms = 15 * 60000;
    else if (tf === '30') expected_delta_ms = 30 * 60000;
    else if (tf === '45') expected_delta_ms = 45 * 60000;
    else if (tf === '60' || tf === '1H' || tf === '1h') expected_delta_ms = 60 * 60000;
    else if (tf === '120' || tf === '2H' || tf === '2h') expected_delta_ms = 120 * 60000;
    else if (tf === '180' || tf === '3H' || tf === '3h') expected_delta_ms = 180 * 60000;
    else if (tf === '240' || tf === '4H' || tf === '4h') expected_delta_ms = 240 * 60000;
    else if (tf === 'D' || tf === '1D') expected_delta_ms = 24 * 60 * 60000;`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(p, content);
    console.log('Patched correctly!');
} else {
    console.log('Target not found!');
}
