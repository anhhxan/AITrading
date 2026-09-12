import { createClient } from '@/lib/supabase/server'
import ResetButton from './ResetButton'
import { Activity, Wallet, Target, AlertCircle, Clock, Square, Hash } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function formatDate(dateString: string) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleString()
}

export default async function PaperTradingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch all paper robots
  const { data: robots, error: robotsError } = await supabase
    .from('robots')
    .select('*')
    .eq('user_id', user.id)
    .in('trading_mode', ['PAPER', 'SANDBOX'])
    .order('created_at', { ascending: true })

  if (robotsError) {
    return (
      <div className="p-8 text-center text-red-500 flex flex-col items-center">
        <AlertCircle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-bold">Lỗi truy vấn Robot</h2>
        <p>Không thể tải danh sách Paper Robots.</p>
      </div>
    )
  }

  if (!robots || robots.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center bg-white border border-slate-200 rounded-xl">
        <Square className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Chưa có Paper Robot</h2>
        <p className="mt-2 text-slate-500 max-w-md">Hãy tạo một Robot với chế độ Paper Trading để bắt đầu.</p>
        <Link href="/dashboard/robots/new" className="mt-6 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium">
          Create Robot
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Paper Trading Workspace</h1>
        <p className="text-slate-500 mt-1">Real-time observational workspace for Direct Paper Execution architecture.</p>
      </div>

      <div className="space-y-12">
        {robots.map((robot) => (
          <RobotPaperWorkspace key={robot.id} robot={robot} />
        ))}
      </div>
    </div>
  )
}

async function RobotPaperWorkspace({ robot }: { robot: any }) {
  const supabase = await createClient()
  
  // 1. ACTIVE POSITIONS
  const { data: positions } = await supabase
    .from('active_positions')
    .select('*')
    .eq('robot_id', robot.id)
    .order('created_at', { ascending: false })

  // 2. RECENT SIGNALS (from robot_commands)
  const { data: signals } = await supabase
    .from('robot_commands')
    .select('*')
    .eq('robot_id', robot.id)
    .eq('command_type', 'TV_SIGNAL')
    .order('created_at', { ascending: false })
    .limit(5)

  // 3. RECENT EXECUTIONS (same as signals, or we can use the same array)
  // We will display execution business result inside the signal table itself as they map 1:1.

  // 4. REALIZED PNL
  const { data: allTrades } = await supabase
    .from('trade_history')
    .select('pnl, fee')
    .eq('robot_id', robot.id)
  
  const hasTrades = allTrades && allTrades.length > 0;
  const realizedPnL = allTrades?.reduce((acc, t) => acc + (t.pnl - t.fee), 0) || 0

  // POSITION STATE logic
  let positionState = 'FLAT'
  if (positions && positions.length > 0) {
    positionState = positions[0].side || 'UNKNOWN'
  }

  const paperBalance = robot.paper_balance || '—'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      
      {/* 1. ROBOT HEADER & POSITION STATE */}
      <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold text-slate-900">{robot.name}</h2>
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-bold tracking-wider">PAPER</span>
            <span className={`text-xs px-2 py-1 rounded font-bold tracking-wider ${robot.status === 'RUNNING' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
              {robot.status || 'UNKNOWN'}
            </span>
            <span className={`text-xs px-3 py-1 rounded-full font-bold tracking-wider border ${
              positionState === 'LONG' ? 'bg-green-50 border-green-200 text-green-700' : 
              positionState === 'SHORT' ? 'bg-red-50 border-red-200 text-red-700' : 
              'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              STATE: {positionState}
            </span>
          </div>
          <div className="text-sm text-slate-500 font-medium flex items-center gap-2">
            <Hash className="w-3.5 h-3.5" />
            {robot.trading_view_symbol || '—'} 
            <span className="text-slate-300">•</span>
            <Clock className="w-3.5 h-3.5" />
            {robot.timeframe || '—'}
          </div>
        </div>
        
        <div className="flex flex-col md:items-end gap-1">
           <div className="text-sm font-semibold text-slate-500">Starting Balance</div>
           <div className="font-mono text-lg font-bold text-slate-800">{paperBalance} USDT</div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        
        {/* 2. ACTIVE POSITIONS */}
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center">
            <Target className="w-4 h-4 mr-2 text-blue-500"/> Active Position
          </h3>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">Symbol</th>
                    <th className="px-4 py-3 font-medium">Side</th>
                    <th className="px-4 py-3 font-medium text-right">Quantity</th>
                    <th className="px-4 py-3 font-medium text-right">Entry Price</th>
                    <th className="px-4 py-3 font-medium text-right">Stop Loss</th>
                    <th className="px-4 py-3 font-medium text-right">Take Profit</th>
                    <th className="px-4 py-3 font-medium text-right">Open Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!positions || positions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        <div className="font-bold text-slate-400">FLAT — No Open Position</div>
                      </td>
                    </tr>
                  ) : (
                    positions.map(pos => (
                      <tr key={pos.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-bold text-slate-900">{pos.symbol || '—'}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${pos.side==='LONG'?'bg-green-100 text-green-700':pos.side==='SHORT'?'bg-red-100 text-red-700':'bg-slate-100'}`}>
                            {pos.side || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-medium">{pos.quantity || '—'}</td>
                        <td className="px-4 py-4 text-right font-mono">{pos.entry_price || '—'}</td>
                        <td className="px-4 py-4 text-right font-mono text-slate-600">{pos.stop_loss_price || '—'}</td>
                        <td className="px-4 py-4 text-right font-mono text-slate-600">{pos.take_profit_price || '—'}</td>
                        <td className="px-4 py-4 text-right text-slate-500">{formatDate(pos.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 3 & 4. RECENT SIGNALS & EXECUTIONS */}
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center">
            <Activity className="w-4 h-4 mr-2 text-indigo-500"/> Recent Signals & Executions
          </h3>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">Timestamp</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Symbol</th>
                    <th className="px-4 py-3 font-medium text-right">Entry Price</th>
                    <th className="px-4 py-3 font-medium">Signal ID</th>
                    <th className="px-4 py-3 font-medium">Command Status</th>
                    <th className="px-4 py-3 font-medium">Business Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!signals || signals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        <div className="text-slate-400">Chưa nhận TradingView Signal</div>
                      </td>
                    </tr>
                  ) : (
                    signals.map(sig => {
                      let payload = {} as any
                      let result = {} as any
                      try { if (sig.payload) payload = typeof sig.payload === 'string' ? JSON.parse(sig.payload) : sig.payload } catch(e) {}
                      try { if (sig.result) result = typeof sig.result === 'string' ? JSON.parse(sig.result) : sig.result } catch(e) {}
                      
                      const action = payload?.action || payload?.side || '—'
                      const symbol = payload?.symbol || '—'
                      const entryPrice = payload?.entry_price || '—'
                      const signalId = payload?.signal_id || '—'
                      
                      const getStatusColor = (status: string) => {
                          if (status === 'COMPLETED' || status === 'FILLED' || status === 'ACCEPTED' || status === 'SUCCEEDED') return 'bg-green-100 text-green-700'
                          if (status === 'FAILED' || status === 'REJECTED') return 'bg-red-100 text-red-700'
                          if (status === 'IGNORED' || status === 'TIMEOUT') return 'bg-orange-100 text-orange-700'
                          return 'bg-slate-100 text-slate-700'
                      }

                      const getActionColor = (a: string) => {
                          if (a.includes('LONG')) return 'text-green-600 font-bold'
                          if (a.includes('SHORT')) return 'text-red-600 font-bold'
                          return 'text-slate-700 font-medium'
                      }

                      let execResultStr = '—'
                      let isResultMuted = true
                      if (result && typeof result === 'object' && result.status) {
                         execResultStr = result.status
                         if (result.reason) execResultStr += `: ${result.reason}`
                         if (result.status.includes('ACCEPTED') || result.status.includes('OPENED') || result.status.includes('CLOSED')) {
                             isResultMuted = false
                         }
                      } else if (typeof result === 'string') {
                         execResultStr = result
                      }

                      return (
                        <tr key={sig.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-500">{formatDate(sig.created_at)}</td>
                          <td className={`px-4 py-3 ${getActionColor(action)}`}>{action}</td>
                          <td className="px-4 py-3 text-slate-600">{symbol}</td>
                          <td className="px-4 py-3 text-right font-mono">{entryPrice}</td>
                          <td className="px-4 py-3 text-slate-400 font-mono text-xs">{signalId}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(sig.status)}`}>
                              {sig.status || 'UNKNOWN'}
                            </span>
                          </td>
                          <td className={`px-4 py-3 font-medium text-xs ${isResultMuted ? 'text-slate-500' : 'text-blue-700'}`}>
                            {execResultStr}
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

        {/* 5. REALIZED PNL & CONTROLS */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
           <div>
             <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Realized PnL</div>
             {!hasTrades ? (
               <div className="text-slate-400 font-medium">Chưa có Realized PnL</div>
             ) : (
               <div className={`text-2xl font-bold ${realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                 {realizedPnL >= 0 ? '+' : ''}{realizedPnL.toFixed(2)} USDT
               </div>
             )}
           </div>
           
           <div className="mt-4 md:mt-0">
             <ResetButton robotId={robot.id} disabled={robot.status === 'RUNNING'} />
           </div>
        </div>

      </div>
    </div>
  )
}
