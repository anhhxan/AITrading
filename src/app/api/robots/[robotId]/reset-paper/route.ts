import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ robotId: string }> }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { robotId } = await params;

  // 1. Verify Robot ownership and status
  const { data: robot, error: rErr } = await supabase
    .from('robots')
    .select('id, user_id, status')
    .eq('id', robotId)
    .single();

  if (rErr || !robot) {
    return NextResponse.json({ error: 'Robot not found' }, { status: 404 });
  }

  if (robot.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (robot.status === 'RUNNING') {
    return NextResponse.json({ error: 'Cannot reset a RUNNING robot. Please stop it first.' }, { status: 400 });
  }

  // 2. Perform deletion and update
  // Supabase REST doesn't natively support full transactions across multiple tables 
  // via the JS client easily without RPC. We will do sequential deletions since it's a paper reset.
  // We delete in order of FK constraints (child first).

  // active_orders
  await supabase.from('active_orders').delete().eq('robot_id', robotId);
  
  // active_positions
  await supabase.from('active_positions').delete().eq('robot_id', robotId);
  
  // trade_history
  await supabase.from('trade_history').delete().eq('robot_id', robotId);
  
  // execution_intents
  await supabase.from('execution_intents').delete().eq('robot_id', robotId);
  
  // core_events (optional, but good for clean slate)
  // await supabase.from('core_events').delete().eq('robot_id', robotId);

  // 3. Reset Balance
  const { error: updErr } = await supabase
    .from('robots')
    .update({ paper_balance: 10000.0 })
    .eq('id', robotId);

  if (updErr) {
    return NextResponse.json({ error: 'Failed to reset balance' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Paper account reset to $10,000' });
}
