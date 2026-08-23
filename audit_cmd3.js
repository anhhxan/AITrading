const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");

async function run() {
  const robotId = "f1610ab1-3177-4930-81fc-6cd98262d7b6";
  const { data: cmds } = await supabase
    .from("robot_commands")
    .select("*")
    .eq("robot_id", robotId)
    .order("created_at", { ascending: false })
    .limit(100);

  const target = cmds.find(c => c.command_id.startsWith("6dd26750"));
  if (!target) {
    console.log("Not found in last 100");
    return;
  }
  
  console.log("=== ROBOT_COMMANDS ===");
  console.log(`command_id: ${target.command_id}`);
  console.log(`status: ${target.status}`);
  console.log(`created_at: ${target.created_at}`);
  console.log(`processed_at: ${target.processed_at}`);
  console.log(`correlation_id: ${target.correlation_id}`);
  
  const result = target.result || {};
  console.log(`barTimestamp: ${result.barTimestamp}`);
  console.log(`timeframe: ${result.timeframe}`);
  console.log(`tvSymbol: ${result.tvSymbol}`);
  console.log(`tvTickerId: ${result.tvTickerId}`);
  
  // 2. Fetch core_events
  const { data: events } = await supabase
    .from("core_events")
    .select("*")
    .eq("correlation_id", target.correlation_id)
    .order("event_sequence", { ascending: true });

  console.log("\n=== CORE_EVENTS ===");
  if (events && events.length > 0) {
    for (const ev of events) {
      console.log(`- ${ev.event_type} (${ev.event_sequence}) | created: ${ev.created_at}`);
      if (ev.event_type === "INDICATOR_UPDATED" || ev.event_type === "STRATEGY_EVALUATED") {
        console.log(JSON.stringify(ev.payload, null, 2));
      }
    }
  } else {
    console.log("No events found for this correlation_id");
  }
}
run();
