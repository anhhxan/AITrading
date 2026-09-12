import { createClient } from '@/lib/supabase/server'
import { Bot, Play, Square, Archive, Activity, FileText, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import RobotControlPanel from './RobotControlPanel'
import TradeHistoryFilter from './TradeHistoryFilter'
import TestSignalButton from './TestSignalButton'
import ResetButton from '../../paper-trading/ResetButton'

export const dynamic = 'force-dynamic'

export default async function RobotDetailPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ tab?: string }> }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const currentTab = resolvedSearchParams.tab || 'overview';
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // 1. Fetch data in parallel using Promise.all to avoid waterfall
  const [
    { data: robot, error: robotError },
    { data: positions, error: positionsError },
    { data: signals, error: signalsError },
    { data: trades, error: tradesError }
  ] = await Promise.all([
    supabase.from('robots').select('*').eq('id', resolvedParams.id).single(),
    supabase.from('active_positions').select('*').eq('robot_id', resolvedParams.id),
    supabase.from('robot_commands').select('*').eq('robot_id', resolvedParams.id).eq('command_type', 'TV_SIGNAL').order('created_at', { ascending: false }).limit(50),
    supabase.from('trade_history').select('*').eq('robot_id', resolvedParams.id).order('created_at', { ascending: false }).limit(20)
  ]);

  if (robotError || !robot) {
    return <div className="p-8 text-center text-red-500 font-bold">Lỗi: Không tìm thấy Robot hoặc bạn không có quyền truy cập.</div>
  }

  // Active Position State
  let positionState = 'FLAT';
  let activePos = null;
  if (positions && positions.length > 0) {
    positionState = positions[0].side;
    activePos = positions[0];
  }

  const isRunning = robot.status === 'RUNNING';

  const formatDate = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleString() : '—';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100">
            <Bot size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              {robot.name}
            </h1>
            <div className="text-sm text-slate-500 font-medium flex items-center gap-2 mt-1">
              <span className="font-mono">{robot.symbol || 'N/A'}</span>
              <span>·</span>
              <span>{robot.timeframe || 'N/A'}</span>
              <span>·</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-blue-100 text-blue-700">{robot.trading_mode || 'PAPER'}</span>
              <span>·</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${isRunning ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
                {robot.status || 'UNKNOWN'}
              </span>
              <span>·</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${positionState === 'LONG' ? 'bg-green-50 border-green-200 text-green-700' : positionState === 'SHORT' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                STATE: {positionState}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
        <Link href={`/dashboard/robots/${robot.id}?tab=overview`} className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap ${currentTab === 'overview' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}>
          Overview
        </Link>
        <Link href={`/dashboard/robots/${robot.id}?tab=signals`} className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap ${currentTab === 'signals' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}>
          Signals & Trades
        </Link>
        <Link href={`/dashboard/robots/${robot.id}?tab=diagnostics`} className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap ${currentTab === 'diagnostics' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}>
          Diagnostics
        </Link>
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {currentTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* ACTIVE POSITION */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-indigo-500" />
                  Active Position
                </h3>
              </div>
              <div className="p-6">
                {!activePos ? (
                  <div className="text-center py-8">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-slate-100 text-slate-600 mb-2">FLAT</span>
                    <p className="text-slate-500 text-sm">No Open Position</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-xs text-slate-500 mb-1 font-semibold">Symbol</p>
                      <p className="font-bold text-slate-900">{activePos.symbol}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1 font-semibold">Side</p>
                      <p className={`font-bold ${activePos.side === 'LONG' ? 'text-green-600' : 'text-red-600'}`}>{activePos.side}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1 font-semibold">Quantity</p>
                      <p className="font-bold text-slate-900">{activePos.quantity}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1 font-semibold">Entry Price</p>
                      <p className="font-mono text-slate-900">{activePos.entry_price || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1 font-semibold">Stop Loss</p>
                      <p className="font-mono text-slate-600">{activePos.stop_loss_price || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1 font-semibold">Take Profit</p>
                      <p className="font-mono text-slate-600">{activePos.take_profit_price || '—'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-slate-500 mb-1 font-semibold">Open Time</p>
                      <p className="text-sm text-slate-700">{formatDate(activePos.created_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* READ-ONLY CONFIGURATION */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Robot Configuration (Read-only)</h3>
              </div>
              <div className="p-6 grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold">TradingView Symbol</p>
                  <p className="font-medium text-slate-900">{robot.trading_view_symbol || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold">Execution Symbol</p>
                  <p className="font-medium text-slate-900">{robot.execution_symbol || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold">Timeframe</p>
                  <p className="font-medium text-slate-900">{robot.timeframe || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold">Starting Paper Balance</p>
                  <p className="font-medium text-slate-900">{robot.paper_balance ? `${robot.paper_balance} USDT` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold">Max Allocation %</p>
                  <p className="font-medium text-slate-900">{robot.max_allocation_percent ? `${robot.max_allocation_percent}%` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold">Max Active Positions</p>
                  <p className="font-medium text-slate-900">{robot.max_active_positions || '1'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* CONTROL PANEL */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center">
                  Lifecycle Controls
                </h3>
              </div>
              <div className="p-6">
                <RobotControlPanel 
                  robotId={robot.id} 
                  currentStatus={robot.status} 
                  tradingEnabled={robot.trading_enabled} // keep for backend compatibility if required
                  action="CONTROLS" 
                />
                <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                  Start or stop the robot. When RUNNING, the Paper Execution Engine will accept signals from TradingView.
                </p>
              </div>
            </div>

            {/* DANGER ZONE */}
            <div className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-red-100 bg-red-50">
                <h3 className="font-bold text-red-800 text-sm uppercase tracking-wider flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Danger Zone
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">Reset Paper Account</p>
                  <p className="text-xs text-slate-500 mb-3">Clear all positions, trades, and reset balance.</p>
                  <ResetButton robotId={robot.id} disabled={isRunning} />
                </div>
                {/* Archive logic is also handled in list view, but can be added here if needed. 
                    For now ResetButton is sufficient for Danger Zone as per requirements. */}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SIGNALS & TRADES */}
      {currentTab === 'signals' && (
        <div className="space-y-6">
          
          {/* RECENT SIGNALS */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Recent TradingView Signals</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">Time</th>
                    <th className="px-6 py-3 font-medium">Action</th>
                    <th className="px-6 py-3 font-medium text-right">Entry Price</th>
                    <th className="px-6 py-3 font-medium text-right">SL / TP</th>
                    <th className="px-6 py-3 font-medium">Command Status</th>
                    <th className="px-6 py-3 font-medium">Business Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!signals || signals.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No TradingView Signal</td></tr>
                  ) : (
                    signals.map((sig: any) => {
                      let payload = {} as any
                      let result = {} as any
                      try { if (sig.payload) payload = typeof sig.payload === 'string' ? JSON.parse(sig.payload) : sig.payload } catch(e) {}
                      try { if (sig.result) result = typeof sig.result === 'string' ? JSON.parse(sig.result) : sig.result } catch(e) {}
                      
                      const action = payload?.action || payload?.side || '—'
                      const entryPrice = payload?.entry_price || '—'
                      const sl = payload?.stop_loss_price || '—'
                      const tp = payload?.take_profit_price || '—'
                      
                      const getStatusColor = (status: string) => {
                          if (status === 'COMPLETED' || status === 'ACCEPTED') return 'bg-green-100 text-green-700'
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
                      if (result && typeof result === 'object' && result.status) {
                         execResultStr = result.status
                         if (result.reason) execResultStr += `: ${result.reason}`
                      } else if (typeof result === 'string') {
                         execResultStr = result
                      }

                      return (
                        <tr key={sig.id} className="hover:bg-slate-50">
                          <td className="px-6 py-3 text-slate-500">{formatDate(sig.created_at)}</td>
                          <td className={`px-6 py-3 ${getActionColor(action)}`}>{action}</td>
                          <td className="px-6 py-3 text-right font-mono">{entryPrice}</td>
                          <td className="px-6 py-3 text-right font-mono text-slate-500 text-xs">{sl} / {tp}</td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(sig.status)}`}>
                              {sig.status || 'UNKNOWN'}
                            </span>
                          </td>
                          <td className="px-6 py-3 font-medium text-xs text-slate-600 max-w-xs truncate" title={execResultStr}>
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

          {/* TRADE HISTORY */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Closed Trades (Realized PnL)</h3>
              <Link href="/dashboard/trades" className="text-xs text-indigo-600 font-semibold hover:underline">View All</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">Open Time</th>
                    <th className="px-6 py-3 font-medium">Close Time</th>
                    <th className="px-6 py-3 font-medium">Side</th>
                    <th className="px-6 py-3 font-medium text-right">Entry</th>
                    <th className="px-6 py-3 font-medium text-right">Exit</th>
                    <th className="px-6 py-3 font-medium text-right">Qty</th>
                    <th className="px-6 py-3 font-medium text-right">Realized PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!trades || trades.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">No Closed Trades</td></tr>
                  ) : (
                    trades.map((trade: any) => {
                      const netPnl = (trade.pnl || 0) - (trade.fee || 0);
                      return (
                        <tr key={trade.id} className="hover:bg-slate-50">
                          <td className="px-6 py-3 text-slate-500 text-xs">{formatDate(trade.created_at)}</td>
                          <td className="px-6 py-3 text-slate-500 text-xs">{formatDate(trade.closed_at)}</td>
                          <td className="px-6 py-3">
                            <span className={`font-bold ${trade.side === 'LONG' ? 'text-green-600' : 'text-red-600'}`}>{trade.side}</span>
                          </td>
                          <td className="px-6 py-3 text-right font-mono">{trade.entry_price}</td>
                          <td className="px-6 py-3 text-right font-mono">{trade.exit_price}</td>
                          <td className="px-6 py-3 text-right font-mono">{trade.quantity}</td>
                          <td className="px-6 py-3 text-right">
                            <span className={`font-bold ${netPnl > 0 ? 'text-green-600' : netPnl < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                              {netPnl > 0 ? '+' : ''}{netPnl.toFixed(2)} USDT
                            </span>
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
      )}

      {/* TAB CONTENT: DIAGNOSTICS */}
      {currentTab === 'diagnostics' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2 flex items-center">
               <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
               Internal Diagnostic Tools
            </h3>
            <p className="text-sm text-slate-500 mb-6">These tools are for developers and auditors to verify signal integrity.</p>
            
            <div className="flex flex-wrap gap-4">
               <TestSignalButton robotId={robot.id} status={robot.status} tradingMode={robot.trading_mode} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Signal Processing Trace</h3>
             </div>
             <div className="p-6">
                {!signals || signals.length === 0 ? (
                  <p className="text-sm text-slate-500">No diagnostic events available.</p>
                ) : (
                  <div className="space-y-6">
                    {signals.slice(0, 5).map((sig: any) => {
                      let payloadStr = 'Malformed JSON';
                      let resultStr = '—';
                      try { payloadStr = typeof sig.payload === 'string' ? JSON.stringify(JSON.parse(sig.payload), null, 2) : JSON.stringify(sig.payload, null, 2) } catch(e) {}
                      try { resultStr = typeof sig.result === 'string' ? JSON.stringify(JSON.parse(sig.result), null, 2) : JSON.stringify(sig.result, null, 2) } catch(e) {}

                      return (
                        <div key={sig.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-sm">
                           <div className="flex justify-between items-center mb-3">
                             <div className="font-semibold text-slate-800">Command ID: {sig.id}</div>
                             <div className="text-xs text-slate-500">{formatDate(sig.created_at)}</div>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs font-semibold text-slate-500 mb-1">Payload (Inbound)</div>
                                <pre className="text-[10px] font-mono bg-slate-900 text-slate-300 p-3 rounded overflow-x-auto max-h-48">{payloadStr}</pre>
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-slate-500 mb-1">Result (Execution)</div>
                                <pre className="text-[10px] font-mono bg-slate-100 text-slate-700 p-3 rounded overflow-x-auto max-h-48">{resultStr}</pre>
                              </div>
                           </div>
                        </div>
                      )
                    })}
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
