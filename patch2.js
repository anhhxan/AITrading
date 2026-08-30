const fs = require('fs');
let file = 'src/core/adapters/tradingview/TradingViewAdapter.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("payload.previousPayload.plots.upper;", "payload.previousPayload.plots.B2;");
content = content.replace("payload.previousPayload.plots.upper2;", "payload.previousPayload.plots.B1;");
content = content.replace("payload.previousPayload.plots.basis;", "payload.previousPayload.plots.B3;");
content = content.replace("payload.previousPayload.plots.lower2;", "payload.previousPayload.plots.B5;");
content = content.replace("payload.previousPayload.plots.lower;", "payload.previousPayload.plots.B4;");

fs.writeFileSync(file, content);
