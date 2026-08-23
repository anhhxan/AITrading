const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");
async function run() {
  const { data: robots } = await supabase.from("robots").select("id, name, timeframe, paper_balance");
  for(const robot of robots) {
    const { data: config } = await supabase.from("robot_configs").select("id, risk_profile").eq("robot_id", robot.id).eq("status", "ACTIVE").single();
    console.log(`Robot: ${robot.name} (${robot.timeframe}) | ID: ${robot.id}`);
    console.log(`Balance: ${robot.paper_balance}`);
    console.log(`Config ID: ${config ? config.id : 'NONE'}`);
    console.log(`Risk Profile:`, config ? config.risk_profile : 'NONE');
    console.log("-------------------");
  }
}
run();
