const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");

async function run() {
  const robotId = "f1610ab1-3177-4930-81fc-6cd98262d7b6";
  const { data: cmds } = await supabase
    .from("robot_commands")
    .select("*")
    .eq("robot_id", robotId)
    .order("created_at", { ascending: false })
    .limit(5);
  
  if (cmds && cmds.length > 0) {
    console.log("Recent commands:");
    cmds.forEach(c => console.log(c.command_id, c.correlation_id));
  } else {
    console.log("No commands for this robot.");
  }
}
run();
