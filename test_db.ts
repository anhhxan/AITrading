import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getSupabaseAdmin } from './src/lib/supabase.ts';
async function test() {
    const { data } = await getSupabaseAdmin().from('core_events').select('event_type, event_sequence').eq('robot_id', '20261111-2222-4000-a000-222222222222').order('event_sequence');
    console.log(data);
}
test();
