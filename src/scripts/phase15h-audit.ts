import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
import { getSupabaseAdmin } from '../lib/supabase';

async function check500() {
  const supabase = getSupabaseAdmin();
  const robotId = 'f1610ab1-3177-4930-81fc-6cd98262d7b6';

  const { data: cmds, error } = await supabase
    .from('robot_commands')
    .select('created_at, status, result')
    .eq('robot_id', robotId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) console.error(error);
  else {
    console.log("LAST 30 ROBOT COMMANDS:");
    cmds.forEach((c: any) => console.log(`${c.created_at} | ${c.status} | ${JSON.stringify(c.result).substring(0, 100)}`));
  }
}

check500().catch(console.error);
