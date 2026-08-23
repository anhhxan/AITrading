const { createClient } = require("@supabase/supabase-js");

const url = "https://gixfypcwpeepjiqwlndk.supabase.co";
const serviceRole = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFub24iLCJpYXQiOjE3ODYwODU0MDQsImV4cCI6MjEwMTY2MTQwNH0.jMjBbkw6d81peNLu5ICREeXvnT6HSczJR4SzqtjNgOE";

async function run() {
  const supabase = createClient(url, serviceRole);
  const anonClient = createClient(url, anonKey);
  
  const robotId = "f1610ab1-3177-4930-81fc-6cd98262d7b6";

  console.log("=== 1. CHECK ROBOTS ===");
  // Test if user_id exists
  const { data: d1, error: e1 } = await supabase.from("robots").select("user_id").eq("id", robotId).limit(1);
  console.log("robots.user_id =", e1 ? "NO (" + e1.message + ")" : "YES");
  
  // Test if owner_id exists
  const { data: d2, error: e2 } = await supabase.from("robots").select("owner_id").eq("id", robotId).limit(1);
  console.log("robots.owner_id =", e2 ? "NO (" + e2.message + ")" : "YES");

  console.log("\n=== 2. CHECK RLS POLICIES ===");
  // I will check the error messages returned when querying as a user or via REST to see if it complains about owner_id
  
  console.log("\n=== 3/5. SERVICE ROLE VS USER READ ===");
  const { data: srData, error: srErr } = await supabase.from("trade_history").select("*").eq("robot_id", robotId).limit(5);
  console.log("SERVICE ROLE READ trade_history:");
  console.log("Data length:", srData ? srData.length : 0);
  console.log("Error:", srErr ? srErr.message : "None");
  
  // To simulate authenticated user, we will just use the anon client. 
  // Wait, anon client without JWT will just fail standard RLS. But if the policy is syntactically invalid (missing column), 
  // postgres evaluates it during query planning and throws a syntax error even for anon users!
  const { data: anonData, error: anonErr } = await anonClient.from("trade_history").select("*").eq("robot_id", robotId).limit(5);
  console.log("ANON USER READ trade_history:");
  console.log("Data length:", anonData ? anonData.length : 0);
  console.log("Error:", anonErr ? anonErr.message : "None");
  
  const { error: anonErr2 } = await anonClient.from("active_orders").select("*").limit(1);
  console.log("ANON USER READ active_orders Error:", anonErr2 ? anonErr2.message : "None");
  
  const { error: anonErr3 } = await anonClient.from("execution_intents").select("*").limit(1);
  console.log("ANON USER READ execution_intents Error:", anonErr3 ? anonErr3.message : "None");
  
  const { error: anonErr4 } = await anonClient.from("active_positions").select("*").limit(1);
  console.log("ANON USER READ active_positions Error:", anonErr4 ? anonErr4.message : "None");

}
run();
