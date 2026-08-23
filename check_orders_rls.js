const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");
async function run() {
  const { data: d1, error: e1 } = await supabase.from("active_orders").select("*").limit(1);
  const { data: d2, error: e2 } = await supabase.from("active_positions").select("*").limit(1);
  const { data: d3, error: e3 } = await supabase.from("execution_intents").select("*").limit(1);
  console.log("active_orders:", e1 ? e1.message : "OK");
  console.log("active_positions:", e2 ? e2.message : "OK");
  console.log("execution_intents:", e3 ? e3.message : "OK");
}
run();
