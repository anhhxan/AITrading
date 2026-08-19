import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseAdmin } from '../lib/supabase';

async function auditGaps() {
  const supabase = getSupabaseAdmin();
  const robotId = 'f1610ab1-3177-4930-81fc-6cd98262d7b6';

  const gaps = [
    { start: '2026-08-19T04:12:00.000Z', end: '2026-08-19T04:35:00.000Z' },
    { start: '2026-08-19T04:36:00.000Z', end: '2026-08-19T04:47:00.000Z' },
    { start: '2026-08-19T02:49:00.000Z', end: '2026-08-19T03:11:00.000Z' } // From earlier 02:48 to 03:12 gap
  ];

  console.log(`\n==================================================`);
  console.log(`PHASE 15A - SUPABASE AUDIT`);
  console.log(`==================================================`);

  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    console.log(`\nGAP #${i + 1}: ${gap.start} to ${gap.end}`);

    const { data: cmds, error: err1 } = await supabase
      .from('robot_commands')
      .select('created_at, status, result')
      .eq('robot_id', robotId)
      .gte('created_at', gap.start)
      .lte('created_at', gap.end);
      
    if (err1) console.error(err1);
    console.log(`robot_commands count: ${cmds?.length || 0}`);
    if (cmds && cmds.length > 0) {
        cmds.forEach(c => console.log(`  - ${c.created_at} | ${c.status} | ${c.result}`));
    }

    const { data: events, error: err2 } = await supabase
      .from('core_events')
      .select('timestamp, event_type')
      .eq('robot_id', robotId)
      .gte('timestamp', new Date(gap.start).getTime())
      .lte('timestamp', new Date(gap.end).getTime());
      
    if (err2) console.error(err2);
    console.log(`core_events count: ${events?.length || 0}`);
  }
}

auditGaps().catch(console.error);
