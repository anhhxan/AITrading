import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  "https://gixfypcwpeepjiqwlndk.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg"
);

async function run() {
  const { data: events } = await supabase.from("core_events")
    .select("event_type, created_at, correlation_id")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log("RECENT CORE_EVENTS:", events);

  const { data: cmds } = await supabase.from("robot_commands")
    .select("command_id, status, created_at, correlation_id")
    .order("created_at", { ascending: false })
    .limit(5);
  console.log("\nRECENT ROBOT_COMMANDS:", cmds);
}
run();
