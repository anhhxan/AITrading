const fs = require('fs');
const data = JSON.parse(fs.readFileSync('commands_dump.json', 'utf8'));

const signal1700 = data.find(c => c.created_at === '2026-08-23T17:00:07.809496+00:00');
console.log(JSON.stringify({ 
  created_at: signal1700.created_at, 
  result: { 
     open: signal1700.result.open,
     high: signal1700.result.high,
     low: signal1700.result.low,
     close: signal1700.result.close,
     plots: signal1700.result.plots,
     barTimestamp: signal1700.result.barTimestamp,
     timeframe: signal1700.result.timeframe
  }
}, null, 2));
