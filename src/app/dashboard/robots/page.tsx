import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Bot } from 'lucide-react'
import RobotListTable from './RobotListTable'

export const dynamic = 'force-dynamic'

export default async function RobotsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // 1. Fetch Robots
  const { data: allRobots, error: robotsError } = await supabase
    .from('robots')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (robotsError) {
    return <div className="p-8 text-center text-red-500">Lỗi truy vấn Robot: {robotsError.message}</div>
  }

  const robots = (allRobots || []).filter(r => r.is_archived !== true)

  // Maps for batch data
  let pnlData: Record<string, number | 'ERROR'> = {}
  let activePositions: Record<string, string | 'ERROR'> = {}
  let lastSignals: Record<string, any | 'ERROR'> = {}
  
  if (robots.length > 0) {
    const robotIds = robots.map(r => r.id)
    
    // 2. Batch Query: Realized PnL
    const { data: trades, error: tradesError } = await supabase
      .from('trade_history')
      .select('robot_id, pnl, fee')
      .in('robot_id', robotIds)
    
    if (tradesError) {
      robotIds.forEach(id => { pnlData[id] = 'ERROR' })
    } else if (trades) {
      trades.forEach(t => {
        if (pnlData[t.robot_id] === undefined) pnlData[t.robot_id] = 0;
        const net = (t.pnl || 0) - (t.fee || 0);
        (pnlData[t.robot_id] as number) += net;
      });
    }

    // 3. Batch Query: Active Positions
    const { data: positions, error: positionsError } = await supabase
      .from('active_positions')
      .select('robot_id, side')
      .in('robot_id', robotIds)
    
    if (positionsError) {
      robotIds.forEach(id => { activePositions[id] = 'ERROR' })
    } else if (positions) {
      positions.forEach(p => {
        activePositions[p.robot_id] = p.side;
      });
    }

    // 4. Batch Query: Last Signals (robot_commands)
    // To get the latest signal per robot without N+1 or complex SQL, we can fetch all TV_SIGNAL for these robots 
    // and group by robot_id in memory. If the table is huge, this is a risk.
    // For a cleaner approach with limited records, we fetch ordered and keep the first seen per robot.
    const { data: commands, error: commandsError } = await supabase
      .from('robot_commands')
      .select('robot_id, payload, created_at')
      .eq('command_type', 'TV_SIGNAL')
      .in('robot_id', robotIds)
      .order('created_at', { ascending: false })
      // Limit slightly higher to account for multiple robots, ideally 50-100 is enough for a fast dashboard
      .limit(100)
    
    if (commandsError) {
      robotIds.forEach(id => { lastSignals[id] = 'ERROR' })
    } else if (commands) {
      commands.forEach(cmd => {
        if (!lastSignals[cmd.robot_id]) {
          lastSignals[cmd.robot_id] = cmd;
        }
      });
    }
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Robot Manager</h2>
          <p className="text-sm text-slate-500 mt-1">Quản lý và giám sát các Paper Robots.</p>
        </div>
        <Link 
          href="/dashboard/robots/new" 
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-slate-900 text-white hover:bg-slate-800 h-10 py-2 px-4"
        >
          <Plus size={18} className="mr-2" />
          Create Robot
        </Link>
      </div>

      {!robots || robots.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Bot size={24} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Chưa có Paper Robot</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">Tạo Robot đầu tiên để bắt đầu giao dịch với tín hiệu TradingView.</p>
          <Link 
            href="/dashboard/robots/new" 
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-10 py-2 px-4"
          >
            Create Robot
          </Link>
        </div>
      ) : (
        <RobotListTable robots={robots} pnlData={pnlData} activePositions={activePositions} lastSignals={lastSignals} />
      )}
    </div>
  );
}
