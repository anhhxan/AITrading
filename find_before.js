const fs = require('fs');
const data = JSON.parse(fs.readFileSync('commands_dump.json', 'utf8'));

const allBefore1700 = data.filter(c => c.created_at >= '2026-08-23T16:55:00' && c.created_at < '2026-08-23T17:00:07.809496+00:00').sort((a,b) => a.created_at.localeCompare(b.created_at));
console.log(`\nFound ${allBefore1700.length} commands before 17:00. Last 3:`);
console.log(JSON.stringify(allBefore1700.slice(-3).map(c => ({ created: c.created_at, type: c.command_type, result: { close: c.result?.close, barTimestamp: c.result?.barTimestamp } })), null, 2));
