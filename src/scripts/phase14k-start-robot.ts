import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseAdmin } from '../lib/supabase';

async function startRobot() {
  const supabase = getSupabaseAdmin();
  const robotId = 'f1610ab1-3177-4930-81fc-6cd98262d7b6';

  console.log(`Starting robot ${robotId}...`);
  
  const { error } = await supabase
    .from('robots')
    .update({ status: 'ACTIVE' })
    .eq('id', robotId);

  if (error) {
    console.error(`Failed to start:`, error);
  } else {
    console.log(`Robot ${robotId} successfully set to ACTIVE (Trading Enabled)!`);
  }
}

startRobot().catch(console.error);
