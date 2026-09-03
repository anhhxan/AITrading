const { RuntimeManager } = require('./src/worker/RuntimeManager.ts');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function test() {
    const rm = new RuntimeManager();
    await rm.initializeEngines();
    await rm.getOrCreateRuntime('7e95b9b5-e113-4d61-92a6-26c9979e7ebc');
    console.log("Config keys:", Array.from(rm.strategyEngine['robotConfig'].keys()));
}
test();
