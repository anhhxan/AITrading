const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: cmd } = await supabase.from('robot_commands')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
    console.log("=== COMMAND ===");
    console.log("result:", JSON.stringify(cmd.result));
}
run();
