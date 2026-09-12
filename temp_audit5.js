const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qusucvfcrtaayensmzht.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1c3VjdmZjcnRhYXllbnNtemh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzk3ODAwNiwiZXhwIjoyMTAzNTU0MDA2fQ.n9QWieDvJqCMPj4gCKy_g3klMpM-c5vJF4ggodhUjb8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  const yesterday20h = new Date('2026-09-07T13:00:00Z').toISOString();
  
  const { data: commands } = await supabase.from('robot_commands')
    .select('status, id')
    .gte('created_at', yesterday20h);
  
  if (commands) {
    const received = commands.filter(c => c.status === 'RECEIVED').length;
    const processing = commands.filter(c => c.status === 'PROCESSING').length;
    const succeeded = commands.filter(c => c.status === 'SUCCEEDED').length;
    const failed = commands.filter(c => c.status === 'FAILED').length;
    console.log(`Commands status breakdown: RECEIVED=${received}, PROCESSING=${processing}, SUCCEEDED=${succeeded}, FAILED=${failed}`);
  }
}

runAudit();
