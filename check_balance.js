const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");
async function run() {
  const { data: robot } = await supabase.from("robots").select("created_at, paper_balance").eq("id", "33f9c37d-64ef-4a01-8aa3-05a1d897c193").single();
  const { data: trades } = await supabase.from("trade_history").select("pnl").eq("robot_id", "33f9c37d-64ef-4a01-8aa3-05a1d897c193");
  
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  console.log("Current Paper Balance:", robot.paper_balance);
  console.log("Total PnL in trade_history:", totalPnl);
  console.log("Implied starting balance:", robot.paper_balance - totalPnl);
}
run();
