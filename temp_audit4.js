const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qusucvfcrtaayensmzht.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1c3VjdmZjcnRhYXllbnNtemh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzk3ODAwNiwiZXhwIjoyMTAzNTU0MDA2fQ.n9QWieDvJqCMPj4gCKy_g3klMpM-c5vJF4ggodhUjb8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  const yesterday20h = new Date('2026-09-07T13:00:00Z').toISOString();
  
  const robotIds = [
    'e0d00614-dfcc-4948-b840-340bfa0f8707',
    '7e95b9b5-e113-4d61-92a6-26c9979e7ebc',
    '1ba05b33-0b3c-4838-9cbb-dfe8161895d9'
  ];

  console.log("=== CHECKING ALL COMMANDS SINCE 20:00 ===");
  const { data: allCommands } = await supabase.from('robot_commands')
    .select('id, robot_id, status, created_at, payload')
    .gte('created_at', yesterday20h)
    .order('created_at', { ascending: false });
  
  if (allCommands) {
    console.log(`Total commands in system since yesterday 20:00: ${allCommands.length}`);
    if (allCommands.length > 0) {
      console.log("Sample of recent commands:");
      console.log(allCommands.slice(0, 5));
    }
  }

  const { data: paperCommands } = await supabase.from('robot_commands')
    .select('*')
    .gte('created_at', yesterday20h)
    .in('robot_id', robotIds);
  console.log(`Commands for 3 active paper robots: ${paperCommands ? paperCommands.length : 0}`);
}

runAudit();
