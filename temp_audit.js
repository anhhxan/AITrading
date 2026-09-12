const { createClient } = require('@supabase/supabase-js');

// Hardcode variables extracted from .env.local
const supabaseUrl = 'https://qusucvfcrtaayensmzht.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1c3VjdmZjcnRhYXllbnNtemh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzk3ODAwNiwiZXhwIjoyMTAzNTU0MDA2fQ.n9QWieDvJqCMPj4gCKy_g3klMpM-c5vJF4ggodhUjb8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log("=== PHASE 0: IDENTIFY PRODUCTION DB ===");
  console.log("URL:", supabaseUrl);

  const yesterday20h = new Date('2026-09-07T13:00:00Z').toISOString();
  console.log("Start Time:", yesterday20h);

  console.log("\n=== PHASE 1: IDENTIFY 3 PAPER ROBOTS ===");
  const { data: robots, error: rErr } = await supabase.from('robots').select('*').in('mode', ['PAPER', 'paper']);
  if (rErr) console.error("Error fetching robots:", rErr);
  else {
    robots.forEach(r => console.log(`Robot ID: ${r.id}, Name: ${r.name}, Mode: ${r.mode}, Status: ${r.status}, Strategy: ${r.strategy}`));
  }
  const robotIds = robots ? robots.map(r => r.id) : [];

  console.log("\n=== PHASE 2: SIGNAL INGRESS (robot_commands) ===");
  const { data: commands, error: cErr } = await supabase.from('robot_commands')
    .select('*')
    .gte('created_at', yesterday20h)
    .order('created_at', { ascending: true });
  
  if (cErr) console.error("Error fetching commands:", cErr);
  else {
    const paperCommands = commands.filter(c => robotIds.includes(c.robot_id));
    console.log(`Total commands for paper robots: ${paperCommands.length}`);
    paperCommands.forEach(c => {
      console.log(`CMD: ${c.id} | Robot: ${c.robot_id} | Status: ${c.status} | Created: ${c.created_at} | Claimed: ${c.claimed_at} | Processed: ${c.processed_at}`);
    });
  }

  console.log("\n=== PHASE 4-5: PIPELINE EVENTS (core_events) ===");
  const { data: events, error: eErr } = await supabase.from('core_events')
    .select('*')
    .gte('created_at', yesterday20h)
    .order('created_at', { ascending: true });

  if (eErr) console.error("Error fetching events:", eErr);
  else {
    const paperEvents = events.filter(e => robotIds.includes(e.robot_id));
    console.log(`Total events for paper robots: ${paperEvents.length}`);
    paperEvents.forEach(e => {
       console.log(`Event: ${e.event_type} | State: ${e.state} | Reason: ${e.reason} | Signal: ${e.signal_direction} | Robot: ${e.robot_id}`);
    });
  }

  console.log("\n=== PHASE 8-9: INTENTS, ORDERS, POSITIONS ===");
  const { data: intents } = await supabase.from('execution_intents').select('*').gte('created_at', yesterday20h);
  console.log(`Intents: ${intents ? intents.length : 0}`);
  if (intents && intents.length > 0) console.log(intents);
  
  const { data: activeOrders } = await supabase.from('active_orders').select('*').gte('created_at', yesterday20h);
  console.log(`Orders: ${activeOrders ? activeOrders.length : 0}`);
}

runAudit();
