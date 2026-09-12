const fs = require('fs');
const data = JSON.parse(fs.readFileSync('commands_dump.json', 'utf8'));

const allAfter1700 = data.filter(c => c.created_at >= '2026-08-23T17:00:00' && c.created_at <= '2026-08-23T17:15:00').sort((a,b) => a.created_at.localeCompare(b.created_at));
console.log(`\nFound ${allAfter1700.length} commands after 17:00. First 10:`);
console.log(JSON.stringify(allAfter1700.slice(0, 10).map(c => ({ created: c.created_at, type: c.command_type, result: { close: c.result?.close, plots: c.result?.plots, barTimestamp: c.result?.barTimestamp } })), null, 2));
