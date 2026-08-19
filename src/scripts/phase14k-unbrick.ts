import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseAdmin } from '../lib/supabase';

async function unbrick() {
  const supabase = getSupabaseAdmin();
  const robotId = 'f1610ab1-3177-4930-81fc-6cd98262d7b6';

  console.log(`Unbricking robot ${robotId}...`);
  
  const { error } = await supabase
    .from('robots')
    .update({ current_state: 'WAIT_SIGNAL' })
    .eq('id', robotId);

  if (error) {
    console.error(`Failed to unbrick:`, error);
  } else {
    console.log(`Robot ${robotId} successfully reset to WAIT_SIGNAL!`);
  }
}

unbrick().catch(console.error);
