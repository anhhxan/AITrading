const fs = require('fs');
let file = 'src/core/adapters/tradingview/TradingViewAdapter.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("if (!payload.plots) validationErrors.push('Missing plots');", "if (!payload.plots) validationErrors.push('Missing plots');\n      if (!payload.plots.B1) validationErrors.push('Missing plots.B1');\n      if (!payload.plots.B2) validationErrors.push('Missing plots.B2');\n      if (!payload.plots.B3) validationErrors.push('Missing plots.B3');\n      if (!payload.plots.B4) validationErrors.push('Missing plots.B4');\n      if (!payload.plots.B5) validationErrors.push('Missing plots.B5');");
content = content.replace(/if \(!payload.plots.upper.*?\);/gs, "");
content = content.replace(/if \(!payload.plots.basis.*?\);/gs, "");
content = content.replace(/if \(!payload.plots.lower.*?\);/gs, "");

content = content.replace("const line1 = payload.plots.upper2;", "const line1 = payload.plots.B1;");
content = content.replace("const line2 = payload.plots.upper;", "const line2 = payload.plots.B2;");
content = content.replace("const line3 = payload.plots.basis;", "const line3 = payload.plots.B3;");
content = content.replace("const line4 = payload.plots.lower;", "const line4 = payload.plots.B4;");
content = content.replace("const line5 = payload.plots.lower2;", "const line5 = payload.plots.B5;");

const check = `
    if (!(line1 > line2 && line2 > line3 && line3 > line4 && line4 > line5)) {
      console.error(\`[TradingViewAdapter] VALIDATION REJECTED: Bands out of order: B1=\${line1}, B2=\${line2}, B3=\${line3}, B4=\${line4}, B5=\${line5}\`);
      return { accepted: false, validationErrors: ["Bands out of order"] };
    }
`;
content = content.replace("const line5 = payload.plots.B5;", "const line5 = payload.plots.B5;\n" + check);

fs.writeFileSync(file, content);
