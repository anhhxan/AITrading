const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");

async function run() {
  const { data: trades } = await supabase.from("trade_history").select("id, created_at, robot_id").limit(10);
  console.log("Trades in DB:", trades);

  const { data: robots } = await supabase.from("robots").select("id, owner_id").eq("id", "f1610ab1-3177-4930-81fc-6cd98262d7b6");
  console.log("Robot owner:", robots);
}
run();
