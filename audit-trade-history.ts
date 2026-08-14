import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getSupabaseAdmin } from './src/lib/supabase';

async function audit() {
  const supabase = getSupabaseAdmin();
  
  // 1. Get count of existing records
  const { count, error } = await supabase.from('trade_history').select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error("Error fetching count:", error);
    return;
  }
  
  console.log(`Total trade_history records: ${count}`);

  // 2. Fetch a sample record to see if we have ANY contextual data to use for migration
  const { data: sample, error: sampleErr } = await supabase.from('trade_history').select('*').limit(1);
  if (sampleErr) {
    console.error("Error fetching sample:", sampleErr);
    return;
  }
  
  console.log("Sample record:", JSON.stringify(sample, null, 2));
}

audit();
