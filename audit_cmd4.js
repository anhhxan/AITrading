const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");

async function run() {
  const { data: cmds } = await supabase
    .from("robot_commands")
    .select("command_id")
    .order("created_at", { ascending: false })
    .limit(500);

  const target = cmds.find(c => c.command_id.startsWith("6dd26750"));
  if (!target) {
    console.log("Not found in last 500");
  } else {
    console.log("Found:", target.command_id);
  }
}
run();
