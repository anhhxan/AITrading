const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");
async function run() {
  const ids = ["f1610ab1-3177-4930-81fc-6cd98262d7b6", "33f9c37d-64ef-4a01-8aa3-05a1d897c193"];
  for (const robotId of ids) {
    const { data: config } = await supabase
      .from("robot_configs")
      .select("id, risk_profile")
      .eq("robot_id", robotId)
      .eq("status", "ACTIVE")
      .single();
      
    if (config) {
      const newRisk = { ...config.risk_profile, position_allocation_percent: 10 };
      const { error } = await supabase
        .from("robot_configs")
        .update({ risk_profile: newRisk })
        .eq("id", config.id);
      console.log(`Robot ${robotId} updated. Error:`, error);
    }
  }
}
run();
