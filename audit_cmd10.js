const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");

async function run() {
  const fullId = "6dd27650-7c70-4b78-a719-3a3f77b74003";
  const { data: cmd } = await supabase.from("robot_commands").select("*").eq("command_id", fullId).single();
  const r = cmd.result || {};
  const prevR = r.previousPayload || {};
  
  console.log("prevClose:", prevR.close);
  if (prevR.plots) {
    console.log("prevB1:", prevR.plots.upper);
    console.log("prevB2:", prevR.plots.upper2);
    console.log("prevB3:", prevR.plots.basis);
    console.log("prevB4:", prevR.plots.lower2);
    console.log("prevB5:", prevR.plots.lower);
  }
  
  console.log("currOpen:", r.open);
  console.log("currClose:", r.close);
  if (r.plots) {
    console.log("currB1:", r.plots.upper);
    console.log("currB2:", r.plots.upper2);
    console.log("currB3:", r.plots.basis);
    console.log("currB4:", r.plots.lower2);
    console.log("currB5:", r.plots.lower);
  }
}
run();
