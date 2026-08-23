const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");
async function run() {
  const { data: cmds } = await supabase.from("robot_commands").select("*").order("created_at", { ascending: false }).limit(100);
  const cmd = cmds.find(c => c.command_id.includes("5c609e81"));
  if (cmd && cmd.result) {
    if (cmd.result.previousPayload) {
      delete cmd.result.previousPayload.previousPayload;
    }
    console.log(JSON.stringify(cmd.result, null, 2));
  }
}
run();
