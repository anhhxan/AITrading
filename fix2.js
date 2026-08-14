const fs = require('fs');

const files = [
  'src/core/__tests__/phase4/risk-engine.test.ts',
  'src/core/__tests__/phase5/market-data-simulator.test.ts',
  'src/core/__tests__/phase5/paper-execution.test.ts',
  'src/core/__tests__/phase5/paper-simulation-e2e.test.ts',
  'src/core/__tests__/phase2/plugin-loader.test.ts',
  'src/core/__tests__/phase2/tradingview-compare.test.ts',
  'src/core/__tests__/phase2/warmup.test.ts',
  'src/core/__tests__/phase2/indicator-engine.test.ts'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');

    // Fix BB_MB registration config errors
    content = content.replace(/params:\s*\{\s*\}/g, "params: { length: 20, source: 'close', mult: 2.0, mult2: 1.0 }");
    content = content.replace(/params:\s*\{\s*length:\s*20,\s*mult:\s*2\s*\}/g, "params: { length: 20, source: 'close', mult: 2.0, mult2: 1.0 }");

    // Fix RiskConfig & TradePlanEvent usages
    // 1. Where riskEngine.registerRobotConfig is used
    content = content.replace(/registerRobotConfig\([^,]+,\s*\{\s*symbol:\s*([^,]+)/g, (match, sym) => {
      return match.replace(`symbol: ${sym}`, `tradingViewSymbol: ${sym}, executionSymbol: ${sym}`);
    });
    
    // 2. Where TradePlanEvent is created manually in tests
    content = content.replace(/symbol:\s*([^,]+)(,\s*direction:\s*'LONG'|,\s*direction:\s*'SHORT')/g, "tradingViewSymbol: $1, executionSymbol: $1$2");

    fs.writeFileSync(f, content);
  }
});
