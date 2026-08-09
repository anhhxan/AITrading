import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    
    // 1. Get robots summary
    const { data: robots, error: robotsError } = await supabase
      .from('robots')
      .select('id, status');

    if (robotsError) throw robotsError;

    const totalRobots = robots ? robots.length : 0;
    const runningRobots = robots ? robots.filter((r: any) => r.status === 'RUNNING').length : 0;

    // 2. Get active positions (assuming we can glean this from robot_snapshots or current_state for now, 
    // or we just return exactly what's in DB. We will query robots with current_state = 'POSITION_OPEN')
    const { data: activePositions, error: posError } = await supabase
      .from('robots')
      .select('id')
      .eq('current_state', 'POSITION_OPEN');
      
    if (posError) throw posError;
    const openPositionsCount = activePositions ? activePositions.length : 0;

    // 3. Get realized PnL from trade_history
    const { data: trades, error: tradesError } = await supabase
      .from('trade_history')
      .select('pnl')
      .eq('action', 'CLOSE');
      
    if (tradesError) throw tradesError;
    const realizedPnL = trades ? trades.reduce((sum: number, t: any) => sum + (Number(t.pnl) || 0), 0) : 0;

    // 4. Get recent logs
    const { data: logs, error: logsError } = await supabase
      .from('logs')
      .select('id, level, message, created_at, category')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (logsError) throw logsError;

    return NextResponse.json({
        totalRobots,
        runningRobots,
        openPositionsCount,
        realizedPnL,
        recentLogs: logs || []
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
