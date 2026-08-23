const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");
async function run() {
  const { data: cmd } = await supabase.from("robot_commands").select("*").eq("command_type", "TV_SIGNAL").order("created_at", { ascending: false }).limit(1);
  console.log(Object.keys(cmd[0]));
  if (cmd[0].payload) console.log("payload:", cmd[0].payload);
  if (cmd[0].result) {
    const keys = Object.keys(cmd[0].result);
    console.log("result keys:", keys);
    if (cmd[0].result.payload) console.log("result.payload exists");
  }
}
run();
