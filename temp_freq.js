const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qusucvfcrtaayensmzht.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1c3VjdmZjcnRhYXllbnNtemh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzk3ODAwNiwiZXhwIjoyMTAzNTU0MDA2fQ.n9QWieDvJqCMPj4gCKy_g3klMpM-c5vJF4ggodhUjb8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFreq() {
  const { data: commands } = await supabase.from('robot_commands')
    .select('created_at, robot_id')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (commands && commands.length > 0) {
    const byRobot = {};
    commands.forEach(c => {
       if (!byRobot[c.robot_id]) byRobot[c.robot_id] = [];
       byRobot[c.robot_id].push(new Date(c.created_at).getTime());
    });
    
    for (const [rid, times] of Object.entries(byRobot)) {
       console.log(`\nRobot: ${rid}`);
       for (let i = 0; i < times.length - 1; i++) {
         const diffSec = (times[i] - times[i+1]) / 1000;
         console.log(`Gap: ${diffSec} seconds (${diffSec/60} minutes)`);
       }
    }
  }
}
checkFreq();
