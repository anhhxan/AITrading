const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join('supabase', 'migrations', '20260807000000_initial_schema.sql'), 'utf8');
const match = content.match(/CREATE TABLE public\.robots \([\s\S]*?\);/);
if(match) console.log(match[0]);
else {
    // Try without public.
    const m2 = content.match(/CREATE TABLE robots \([\s\S]*?\);/);
    if(m2) console.log(m2[0]);
    else console.log("Not found in 000000. Trying 000010...");
}
