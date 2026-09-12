const fs = require('fs');
const data = JSON.parse(fs.readFileSync('commands_dump.json', 'utf8'));

const signal1702 = data.find(c => c.created_at === '2026-08-23T17:02:04.143012+00:00');
const signal1706 = data.find(c => c.created_at === '2026-08-23T17:06:03.09764+00:00');

console.log(JSON.stringify({ 
  signal1702: signal1702 ? signal1702.result : null,
  signal1706: signal1706 ? signal1706.result : null
}, null, 2));
