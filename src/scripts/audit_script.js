require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runAudit() {
  console.log("=== ROBOT COMMANDS ===");
  const { data: cmdData, error: cmdErr } = await supabase.from('robot_commands').select('status');
  if (cmdData) {
      const counts = cmdData.reduce((acc, row) => {
          acc[row.status] = (acc[row.status] || 0) + 1;
          return acc;
      }, {});
      console.log(counts);
      console.log(`Total: ${cmdData.length}`);
  }

  console.log("\n=== CORE EVENTS ===");
  const { data: evData, error: evErr } = await supabase.from('core_events').select('event_type, created_at');
  if (evData) {
      const stats = evData.reduce((acc, row) => {
          if (!acc[row.event_type]) acc[row.event_type] = { count: 0, min: row.created_at, max: row.created_at };
          acc[row.event_type].count++;
          if (row.created_at < acc[row.event_type].min) acc[row.event_type].min = row.created_at;
          if (row.created_at > acc[row.event_type].max) acc[row.event_type].max = row.created_at;
          return acc;
      }, {});
      console.log(stats);
      console.log(`Total Events: ${evData.length}`);
  }

  console.log("\n=== DIAGNOSTICS/TRACES ===");
  const { data: trData, error: trErr } = await supabase.from('signal_traces').select('created_at').order('created_at', { ascending: false }).limit(100);
  console.log(`Total Traces returned (limit 100): ${trData ? trData.length : 0}`);
  if(trErr) console.log(trErr.message);
  
  console.log("\n=== STORAGE ===");
  // Cannot easily list bucket size directly via client, will just list buckets
  const { data: buckets } = await supabase.storage.listBuckets();
  console.log(buckets);
}

runAudit();
