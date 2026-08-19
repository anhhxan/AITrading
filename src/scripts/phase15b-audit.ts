import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseAdmin } from '../lib/supabase';

async function auditPhase15B() {
  const supabase = getSupabaseAdmin();
  const robotId = 'f1610ab1-3177-4930-81fc-6cd98262d7b6';

  // The user's times: 12:00 to 13:15. Since my local time is +07:00, 
  // 12:00 local is 05:00 UTC. 13:15 local is 06:15 UTC.
  // I will just query UTC today.
  const startUTC = new Date().toISOString().split('T')[0] + 'T05:00:00.000Z';
  const endUTC = new Date().toISOString().split('T')[0] + 'T06:30:00.000Z';

  console.log(`\nQuerying from ${startUTC} to ${endUTC}`);

  const { data: cmds, error: err1 } = await supabase
    .from('robot_commands')
    .select('created_at, status, result')
    .eq('robot_id', robotId)
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true });
    
  if (err1) console.error(err1);
  console.log(`\n=== ROBOT COMMANDS ===`);
  cmds?.forEach(c => console.log(`${c.created_at} | ${c.status} | ${JSON.stringify(c.result).substring(0, 100)}`));

  const { data: events, error: err2 } = await supabase
    .from('core_events')
    .select('created_at, event_type, payload')
    .eq('robot_id', robotId)
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true });
    
  if (err2) console.error(err2);
  console.log(`\n=== CORE EVENTS ===`);
  events?.forEach(e => console.log(`${e.created_at} | ${e.event_type} | ${JSON.stringify(e.payload).substring(0, 100)}`));
}

auditPhase15B().catch(console.error);
