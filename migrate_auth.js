const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.migration' });

const TARGET_URL = `https://${process.env.SUPABASE_TARGET_PROJECT_REF}.supabase.co`;
const TARGET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1c3VjdmZjcnRhYXllbnNtemh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzk3ODAwNiwiZXhwIjoyMTAzNTU0MDA2fQ.n9QWieDvJqCMPj4gCKy_g3klMpM-c5vJF4ggodhUjb8';

const targetSupabase = createClient(TARGET_URL, TARGET_KEY);

const usersToCreate = [
    { sourceId: 'f8205583-b23e-45f6-b214-e27c6f75a78c', email: 'xuananh0190@gmail.com' },
    { sourceId: '0ddaac30-446e-4fc9-b518-ef943f63ad89', email: 'xuan@gmail.com' }, // User requested xuan@gmail.com for this UUID! Wait, in my output it was xuananh@gmail.com, but user prompt says xuan@gmail.com. I will use what they asked.
    { sourceId: '00000000-0000-0000-0000-000000000001', email: 'dummy_phase3@example.com' }
];

async function migrateAuth() {
    const uuidMap = {};
    const reportLines = ['# D4 AUTH MIGRATION MAPPING\n'];
    
    let hasError = false;

    for (const u of usersToCreate) {
        console.log(`Creating user: ${u.email}`);
        
        // Generate a secure random password since we can't migrate the hash via API
        const tempPassword = 'Temp_' + Math.random().toString(36).slice(-10) + 'A1!';
        
        const { data, error } = await targetSupabase.auth.admin.createUser({
            email: u.email,
            password: tempPassword,
            email_confirm: true
        });
        
        if (error) {
            console.error(`Failed to create ${u.email}:`, error.message);
            hasError = true;
            break;
        }
        
        const targetId = data.user.id;
        uuidMap[u.sourceId] = targetId;
        
        reportLines.push(`Source UUID: \`${u.sourceId}\` (${u.email})`);
        reportLines.push(`→ Target UUID: \`${targetId}\`\n`);
    }

    if (!hasError) {
        fs.writeFileSync('C:\\Users\\pc\\.gemini\\antigravity\\brain\\e2d27aed-689b-4379-bf61-e6836f7d3f9c\\uuid_map.json', JSON.stringify(uuidMap, null, 2));
        fs.writeFileSync('C:\\Users\\pc\\.gemini\\antigravity\\brain\\e2d27aed-689b-4379-bf61-e6836f7d3f9c\\D4_AUTH_MIGRATION_REPORT.md', reportLines.join('\n'));
        console.log('Auth migration completed successfully. UUID mapping saved.');
    } else {
        console.error('Auth migration STOPPED due to errors.');
    }
}

migrateAuth();
