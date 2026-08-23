const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");

async function run() {
  const robotId = "f1610ab1-3177-4930-81fc-6cd98262d7b6";

  // 1. Check robot status
  const { data: robot } = await supabase.from("robots").select("status, trading_mode, trading_enabled").eq("id", robotId).single();
  console.log("=== ROBOT STATUS ===");
  console.log(robot);

  // 2. Check active positions
  const { data: pos } = await supabase.from("active_positions").select("*").eq("robot_id", robotId);
  console.log("\n=== ACTIVE POSITIONS ===");
  console.log(pos.length > 0 ? pos : "No active positions.");

  // 3. Fetch latest 5 commands
  const { data: cmds } = await supabase.from("robot_commands")
    .select("command_id, status, created_at, result")
    .eq("robot_id", robotId)
    .order("created_at", { ascending: false })
    .limit(3);

  console.log("\n=== LATEST CANDLE SIGNALS ===");
  if (cmds) {
    cmds.forEach((cmd, i) => {
      const r = cmd.result || {};
      const prevR = r.previousPayload || {};
      
      const prevClose = prevR.close;
      const prevB1 = prevR.plots ? prevR.plots.upper : null;
      const prevB5 = prevR.plots ? prevR.plots.lower : null;
      
      const currOpen = r.open;
      const currClose = r.close;
      const currB1 = r.plots ? r.plots.upper : null;
      const currB5 = r.plots ? r.plots.lower : null;

      let signal = "NONE";
      if (prevClose <= prevB5 && currClose > currB5 && currClose >= currOpen) {
          signal = "LONG";
      } else if (prevClose >= prevB1 && currClose < currB1 && currClose <= currOpen) {
          signal = "SHORT";
      }

      console.log(`[Candle ${i}] Time: ${cmd.created_at} | Status: ${cmd.status}`);
      console.log(`   Prev: C=${prevClose} B1=${prevB1} B5=${prevB5}`);
      console.log(`   Curr: O=${currOpen} C=${currClose} B1=${currB1} B5=${currB5}`);
      console.log(`   Expected Strategy Result: ${signal}`);
    });
  }
}
run();
