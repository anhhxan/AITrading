const fs = require('fs');

const commands = JSON.parse(fs.readFileSync('commands_dump.json', 'utf8'));
const cmds1m = commands.filter(c => c.result?.timeframe === '1' || c.result?.timeframe === '1m');

// Sort by barTimestamp ascending
cmds1m.sort((a, b) => a.result.barTimestamp - b.result.barTimestamp);

if (cmds1m.length === 0) {
  console.log("No 1m commands found.");
  process.exit(0);
}

const firstBar = cmds1m[0].result.barTimestamp;
const lastBar = cmds1m[cmds1m.length - 1].result.barTimestamp;

console.log(`Start time: ${new Date(firstBar).toISOString()} (${firstBar})`);
console.log(`End time: ${new Date(lastBar).toISOString()} (${lastBar})`);

// Calculate expected candles
const expected = Math.floor((lastBar - firstBar) / (60 * 1000)) + 1;
console.log(`Expected candles: ${expected}`);

// Analyze uniqueness and missing
const barSet = new Set();
let duplicates = 0;

cmds1m.forEach(c => {
  if (barSet.has(c.result.barTimestamp)) {
    duplicates++;
  }
  barSet.add(c.result.barTimestamp);
});

console.log(`UNIQUE barTimestamp: ${barSet.size}`);
console.log(`Duplicate barTimestamp: ${duplicates}`);

const coverage = ((barSet.size / expected) * 100).toFixed(2);
console.log(`WEBHOOK COVERAGE = ${coverage} %`);

if (barSet.size < expected) {
  console.log(`Missing candles sample:`);
  let missingCount = 0;
  for (let t = firstBar; t <= lastBar; t += 60000) {
    if (!barSet.has(t)) {
      if (missingCount < 10) console.log(`MISSING: ${new Date(t).toISOString()}`);
      missingCount++;
    }
  }
  console.log(`Total missing: ${missingCount}`);
}

let succeeded = cmds1m.filter(c => c.status === 'SUCCEEDED').length;
let failed = cmds1m.filter(c => c.status === 'FAILED').length;
let processing = cmds1m.filter(c => c.status === 'PROCESSING').length;
let received = cmds1m.filter(c => c.status === 'RECEIVED').length;
console.log(`TOTAL WEBHOOK: ${cmds1m.length}, SUCCEEDED: ${succeeded}, FAILED: ${failed}, PROCESSING: ${processing}, RECEIVED: ${received}`);

