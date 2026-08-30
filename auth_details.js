const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.migration' });

async function getAuthDetails() {
    const sourceSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: users, error } = await sourceSupabase.auth.admin.listUsers();
    if (error) throw error;
    
    users.users.forEach(u => {
        console.log(`\nUser ID: ${u.id}`);
        console.log(`Email: ${u.email}`);
        console.log(`Created At: ${u.created_at}`);
        if (u.identities && u.identities.length > 0) {
            u.identities.forEach(id => {
                console.log(`  Identity: ${id.identity_data?.email || id.id}, Provider: ${id.provider}`);
            });
        } else {
            console.log(`  No identities found.`);
        }
    });
}
getAuthDetails();
