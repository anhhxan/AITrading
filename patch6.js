const fs = require('fs');
let file = 'src/core/adapters/tradingview/TradingViewAdapter.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("upper: number;\n    upper2: number;\n    basis: number;\n    lower2: number;\n    lower: number;", "B1: number;\n    B2: number;\n    B3: number;\n    B4: number;\n    B5: number;");

fs.writeFileSync(file, content);
