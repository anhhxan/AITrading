const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");

async function run() {
  const robotId = "f1610ab1-3177-4930-81fc-6cd98262d7b6";
  const { data: events } = await supabase
    .from("core_events")
    .select("event_type, correlation_id, created_at")
    .eq("robot_id", robotId)
    .gte("created_at", "2026-08-23T11:26:00+00:00")
    .lte("created_at", "2026-08-23T11:28:00+00:00");
    
  console.log(events);
}
run();
