const fs = require('fs');

const files = [
  'src/core/__tests__/phase4/risk-engine.test.ts',
  'src/core/__tests__/phase5/market-data-simulator.test.ts',
  'src/core/__tests__/phase5/paper-execution.test.ts',
  'src/core/__tests__/phase5/paper-simulation-e2e.test.ts',
  'src/scratch.ts',
  'src/scripts/phase4-runtime-smoke.ts',
  'src/scripts/tradingview-real-verifier.ts',
  'src/scripts/tradingview-webhook-receiver.ts'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    // Replace symbol: '...' with tradingViewSymbol: '...', executionSymbol: '...'
    content = content.replace(/symbol\s*:\s*(['"][^'"]+['"])/g, 'tradingViewSymbol: $1, executionSymbol: $1');
    // Replace symbol, with tradingViewSymbol: symbol, executionSymbol: symbol,
    content = content.replace(/symbol\s*,/g, 'tradingViewSymbol: symbol, executionSymbol: symbol,');
    fs.writeFileSync(f, content);
  }
});
