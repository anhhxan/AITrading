import { createClient } from '@/lib/supabase/server'
import ResetButton from './ResetButton'
import { Activity, Wallet, PieChart, TrendingUp, TrendingDown, Clock, Tag } from 'lucide-react'

export default async function PaperTradingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch all robots belonging to this user
  const { data: robots } = await supabase
    .from('robots')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (!robots || robots.length === 0) {
    return <div className="p-8 text-center text-slate-500">No robots found. Please create a robot first.</div>
  }

  // We'll show the primary robot (or allow a dropdown in future). For MVP, we map over them or just show the first.
  // We'll just display a card for each robot.
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Paper Trading</h1>
        <p className="text-slate-500 mt-1">Virtual environment for testing strategies with real market data.</p>
      </div>

      {robots.map((robot) => (
        <RobotPaperCard key={robot.id} robot={robot} />
      ))}
    </div>
  )
}

async function RobotPaperCard({ robot }: { robot: any }) {
  const supabase = await createClient()
  
  // Fetch associated paper data
  const { data: positions } = await supabase.from('active_positions').select('*').eq('robot_id', robot.id)
  const { data: orders } = await supabase.from('active_orders').select('*').eq('robot_id', robot.id).order('created_at', { ascending: false }).limit(5)
  const { data: trades } = await supabase.from('trade_history').select('*').eq('robot_id', robot.id).order('created_at', { ascending: false }).limit(5)

  const balance = Number(robot.paper_balance || 10000)
  const unrealizedPnL = positions?.reduce((acc, pos) => acc + (pos.unrealized_pnl || 0), 0) || 0
  const equity = balance + unrealizedPnL
  
  // Calculate total realized PnL
  const { data: allTrades } = await supabase.from('trade_history').select('pnl, fee').eq('robot_id', robot.id)
  const realizedPnL = allTrades?.reduce((acc, t) => acc + (t.pnl - t.fee), 0) || 0

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-8">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center">
            {robot.name} <span className="ml-3 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">{robot.trading_mode || 'PAPER'} MODE</span>
          </h2>
          <p className="text-sm text-slate-500 font-mono mt-0.5">{robot.execution_symbol || 'N/A'}</p>
        </div>
        <ResetButton robotId={robot.id} disabled={robot.status === 'RUNNING'} />
      </div>

      <div className="p-6 space-y-8">
        
        {/* Account Summary */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center"><Wallet className="w-4 h-4 mr-2"/> Account Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-sm text-slate-500 mb-1">Paper Balance</div>
              <div className="text-xl font-bold text-slate-900">${balance.toFixed(2)}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-sm text-slate-500 mb-1">Current Equity</div>
              <div className="text-xl font-bold text-blue-600">${equity.toFixed(2)}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-sm text-slate-500 mb-1">Unrealized PnL</div>
              <div className={`text-xl font-bold ${unrealizedPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-sm text-slate-500 mb-1">Realized PnL</div>
              <div className={`text-xl font-bold ${realizedPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {realizedPnL >= 0 ? '+' : ''}{realizedPnL.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Open Positions */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center"><PieChart className="w-4 h-4 mr-2"/> Open Positions</h3>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium">Side</th>
                  <th className="px-4 py-3 font-medium text-right">Quantity</th>
                  <th className="px-4 py-3 font-medium text-right">Entry Price</th>
                  <th className="px-4 py-3 font-medium text-right">Unrealized PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!positions || positions.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No open positions.</td></tr>
                ) : (
                  positions.map(pos => (
                    <tr key={pos.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{pos.symbol}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${pos.side==='LONG'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{pos.side}</span>
                      </td>
                      <td className="px-4 py-3 text-right">{pos.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono">${pos.entry_price}</td>
                      <td className={`px-4 py-3 text-right font-bold ${pos.unrealized_pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {pos.unrealized_pnl >= 0 ? '+' : ''}{pos.unrealized_pnl}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Paper Orders */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center"><Tag className="w-4 h-4 mr-2"/> Paper Orders</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Side / Qty</th>
                    <th className="px-4 py-3 font-medium text-right">Fill Price</th>
                    <th className="px-4 py-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!orders || orders.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No recent orders.</td></tr>
                  ) : (
                    orders.map(order => (
                      <tr key={order.id}>
                        <td className="px-4 py-3 text-slate-500">{new Date(order.created_at).toLocaleTimeString()}</td>
                        <td className="px-4 py-3"><span className={`font-medium ${order.side==='BUY'?'text-emerald-600':'text-red-600'}`}>{order.side}</span> {order.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono">${order.average_fill_price || order.price || 'MKT'}</td>
                        <td className="px-4 py-3 text-right"><span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded">{order.status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trade History */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center"><Activity className="w-4 h-4 mr-2"/> Trade History</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium text-right">Price</th>
                    <th className="px-4 py-3 font-medium text-right">Net PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!trades || trades.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No trade history.</td></tr>
                  ) : (
                    trades.map(trade => {
                      const netPnl = trade.pnl - trade.fee;
                      return (
                        <tr key={trade.id}>
                          <td className="px-4 py-3 text-slate-500">{new Date(trade.created_at).toLocaleTimeString()}</td>
                          <td className="px-4 py-3 font-medium">{trade.action} {trade.amount}</td>
                          <td className="px-4 py-3 text-right font-mono">${trade.entry_price || trade.exit_price}</td>
                          <td className={`px-4 py-3 text-right font-bold ${netPnl > 0 ? 'text-emerald-600' : netPnl < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                            {netPnl > 0 ? '+' : ''}{netPnl.toFixed(2)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
