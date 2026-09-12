const fs = require('fs');
const data = JSON.parse(fs.readFileSync('commands_dump.json', 'utf8'));
const signal1700 = data.find(c => c.created_at.includes('17:00:07'));
console.log(JSON.stringify(signal1700, null, 2));

const allAfter1700 = data.filter(c => c.created_at >= '2026-08-23T17:00:00' && c.created_at <= '2026-08-23T18:00:00');
console.log(`\nFound ${allAfter1700.length} commands after 17:00. First 3:`);
console.log(JSON.stringify(allAfter1700.slice(0, 3).map(c => ({ created: c.created_at, type: c.command_type, result: c.result })), null, 2));
