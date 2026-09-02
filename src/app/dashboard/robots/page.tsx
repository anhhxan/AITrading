import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import RobotListTable from './RobotListTable'

export default async function RobotsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: allRobots } = await supabase
    .from('robots')
    .select('*, trading_accounts!fk_robots_trading_account(name)')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  // Safely filter out archived robots (in memory, to prevent crashes if column doesn't exist yet)
  const robots = (allRobots || []).filter(r => r.is_archived !== true)

  // Fetch PnL and Active Positions
  let pnlData: Record<string, number> = {}
  let activePositions: Record<string, { side: string, unrealized_pnl: number }> = {}
  
  if (robots && robots.length > 0) {
    const robotIds = robots.map(r => r.id)
    
    const { data: trades } = await supabase
      .from('trade_history')
      .select('robot_id, pnl')
      .in('robot_id', robotIds)
    
    if (trades) {
      trades.forEach(t => {
        if (!pnlData[t.robot_id]) pnlData[t.robot_id] = 0;
        pnlData[t.robot_id] += (t.pnl || 0);
      });
    }

    const { data: positions } = await supabase
      .from('active_positions')
      .select('robot_id, side, unrealized_pnl')
      .in('robot_id', robotIds)
    
    if (positions) {
      positions.forEach(p => {
        activePositions[p.robot_id] = { side: p.side, unrealized_pnl: p.unrealized_pnl || 0 };
        if (!pnlData[p.robot_id]) pnlData[p.robot_id] = 0;
        pnlData[p.robot_id] += (p.unrealized_pnl || 0);
      });
    }
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Trading Robots</h2>
          <p className="text-sm text-slate-500 mt-1">Manage and monitor your digital trading employees.</p>
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
            <Plus size={24} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-1">No robots found</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">Get started by creating your first trading robot to automate your strategies.</p>
          <Link 
            href="/dashboard/robots/new" 
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-10 py-2 px-4"
          >
            Create Robot
          </Link>
        </div>
      ) : (
        <RobotListTable robots={robots} pnlData={pnlData} activePositions={activePositions} />
      )}
    </div>
  );
}
