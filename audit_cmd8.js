const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");

async function run() {
  const fullId = "6dd27650-7c70-4b78-a719-3a3f77b74003";
  const { data: cmdData } = await supabase.from("robot_commands").select("*").eq("command_id", fullId).single();
  const cmd = cmdData;
  
  console.log("=== 1. ROBOT_COMMANDS ===");
  console.log(`command_id: ${cmd.command_id}`);
  console.log(`status: ${cmd.status}`);
  console.log(`created_at: ${cmd.created_at}`);
  console.log(`processed_at: ${cmd.processed_at}`);
  console.log(`correlation_id: ${cmd.correlation_id}`);
  const result = cmd.result || {};
  console.log(`barTimestamp: ${result.barTimestamp}`);
  console.log(`timeframe: ${result.timeframe}`);
  console.log(`tvSymbol: ${result.tvSymbol}`);
  console.log(`tvTickerId: ${result.tvTickerId}`);
  
  console.log("\n=== 2/3. CORE_EVENTS ===");
  const { data: events } = await supabase.from("core_events").select("*").eq("correlation_id", cmd.correlation_id).order("event_sequence", { ascending: true });
  if (events) {
    for (const ev of events) {
      console.log(`- ${ev.event_type} | seq: ${ev.event_sequence} | created: ${ev.created_at}`);
      if (ev.event_type === "INDICATOR_UPDATED" || ev.event_type === "STRATEGY_EVALUATED" || ev.event_type === "STRATEGY_SIGNAL_EVENT") {
        console.log(JSON.stringify(ev.payload, null, 2));
      }
    }
  }
}
run();
