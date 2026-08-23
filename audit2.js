const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");
async function run() {
  const t = ["execution_intents", "active_orders", "active_positions", "trade_history"];
  for (const table of t) {
    const { data: cols } = await supabase.from(table).select("*").limit(1);
    if(cols && cols.length>0) console.log(table, ": ", Object.keys(cols[0]));
    else console.log(table, ": No data, cannot determine columns directly via select * limit 1");
  }
}
run();
