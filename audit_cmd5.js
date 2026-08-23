const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");

async function run() {
  // We can fetch by doing eq on the full UUID if we have it... but we only have prefix.
  // Instead, let's fetch all.
  let page = 0;
  while (page < 10) {
    const { data: cmds } = await supabase
      .from("robot_commands")
      .select("command_id, result")
      .order("created_at", { ascending: false })
      .range(page * 1000, (page + 1) * 1000 - 1);
      
    if (!cmds || cmds.length === 0) break;
    
    const target = cmds.find(c => c.command_id.startsWith("6dd26750"));
    if (target) {
      console.log("FOUND FULL ID:", target.command_id);
      return;
    }
    page++;
  }
  console.log("Completely not found.");
}
run();
