const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");

async function run() {
  const robotId = "f1610ab1-3177-4930-81fc-6cd98262d7b6";
  const { data: hist } = await supabase.from("trade_history").select("*").eq("robot_id", robotId).order("created_at", { ascending: false }).limit(5);
  console.log("\n=== TRADE HISTORY ===");
  console.log(hist);
}
run();
