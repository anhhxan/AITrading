import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getSupabaseAdmin } from '../../../lib/supabase';

async function run() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('trade_history').select('*').limit(1);
  if (error) {
    console.error("Error querying trade_history:", error.message);
  } else {
    console.log("trade_history data:", data);
  }
}
run();
