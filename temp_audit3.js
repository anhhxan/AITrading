const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qusucvfcrtaayensmzht.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1c3VjdmZjcnRhYXllbnNtemh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzk3ODAwNiwiZXhwIjoyMTAzNTU0MDA2fQ.n9QWieDvJqCMPj4gCKy_g3klMpM-c5vJF4ggodhUjb8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  const { data: allRobots, error: rErr } = await supabase.from('robots').select('*');
  console.log("ALL ROBOTS:");
  if (allRobots) {
     allRobots.forEach(r => console.log(`- ID: ${r.id}, Name: ${r.name}, Mode: ${r.mode || r.trading_mode || r.type}, Status: ${r.status}, strategy: ${r.strategy}`));
  }
}

runAudit();
