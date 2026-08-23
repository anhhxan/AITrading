import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gixfypcwpeepjiqwlndk.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg"
);

async function run() {
  const { data: cmds, error } = await supabase
    .from("robot_commands")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !cmds) {
    console.log("Error fetching cmds", error);
    return;
  }

  const cmd = cmds.find(c => c.command_id.includes("5c609e81"));

  if (!cmd) {
    console.log("Command not found in last 100");
    return;
  }

  console.log("=== COMMAND ===");
  console.log(JSON.stringify(cmd, null, 2));

  console.log("\n=== CORE EVENTS ===");
  const { data: events } = await supabase
    .from("core_events")
    .select("*")
    .eq("correlation_id", cmd.correlation_id)
    .order("event_sequence", { ascending: true });
    
  for(const e of events || []) {
      console.log(`[${e.event_type}] payload: ${JSON.stringify(e.payload)}`);
  }

  console.log("\n=== LOGS ===");
  const { data: logs } = await supabase
    .from("logs")
    .select("*")
    .eq("robot_id", cmd.robot_id)
    .gte("created_at", cmd.created_at)
    .limit(30)
    .order("created_at", { ascending: true });

  for(const l of logs || []) {
      console.log(`[${l.category}][${l.level}] ${l.message} | ${JSON.stringify(l.payload || {})}`);
  }
}

run();
