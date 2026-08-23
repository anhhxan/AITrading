import { createClient } from '@/lib/supabase/server'
import { Bot, Play, Square, Archive, Activity, FileText, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import RobotControlPanel from './RobotControlPanel'
import TradeHistoryFilter from './TradeHistoryFilter'
import TestSignalButton from './TestSignalButton'
import SignalPipelineMonitor from './SignalPipelineMonitor'

export default async function RobotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch Robot
  const { data: robot } = await supabase
    .from('robots')
    .select('*, trading_accounts(name)')
    .eq('id', resolvedParams.id)
    .single()

  if (!robot) {
    return <div>Robot not found or access denied</div>
  }

  // Fetch Configs
  const { data: configs } = await supabase
    .from('robot_configs')
    .select('*')
    .eq('robot_id', resolvedParams.id)
    .order('version', { ascending: false })

  const { data: positions } = await supabase
    .from('active_positions')
    .select('*')
    .eq('robot_id', resolvedParams.id);

  const { data: activeOrders } = await supabase
    .from('active_orders')
    .select('*')
    .eq('robot_id', resolvedParams.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: intents } = await supabase
    .from('execution_intents')
    .select('*')
    .eq('robot_id', resolvedParams.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: trades } = await supabase
    .from('trade_history')
    .select('*')
    .eq('robot_id', resolvedParams.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const getHeartbeatStatus = (lastHeartbeat: string | null) => {
    if (!lastHeartbeat) {
      return <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Worker not connected</span>;
    }
    const heartbeatTime = new Date(lastHeartbeat).getTime();
    const now = Date.now();
    if (now - heartbeatTime < 60000) {
      return <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded font-medium border border-emerald-100">ONLINE</span>;
    }
    return <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded font-medium border border-red-100">OFFLINE</span>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
            <Bot size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              {robot.name}
              {robot.status === 'RUNNING' && <span className="flex h-2 w-2 rounded-full bg-green-500"></span>}
            </h1>
            <div className="text-sm text-slate-500 font-mono mt-0.5">{robot.slug}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getHeartbeatStatus(robot.last_heartbeat_at)}
        </div>
      </div>

      <div className="flex flex-col space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center">
                <Activity className="w-4 h-4 mr-2" />
                Status Overview
              </h3>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div>
                <p className="text-xs text-slate-500 mb-1">Lifecycle Status</p>
                <p className="font-semibold text-slate-900 min-w-0 break-words">{robot.status}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Engine State</p>
                <p className="font-semibold text-indigo-600 min-w-0 break-words">{robot.current_state || 'UNKNOWN'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Trading Mode</p>
                <p className="font-semibold text-slate-900 min-w-0 break-words">{robot.trading_mode || 'PAPER'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Paper Balance</p>
                <p className="font-semibold text-blue-600 min-w-0 break-words">${Number(robot.paper_balance || 10000).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Trading Status</p>
                <p className="font-semibold text-slate-900 min-w-0 break-words">{robot.trading_enabled ? <span className="text-emerald-600">ON</span> : <span className="text-slate-500">PAUSED</span>}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">TradingView Symbol</p>
                <p className="font-semibold text-slate-900 min-w-0 break-words">{robot.trading_view_symbol || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Execution Symbol</p>
                <p className="font-semibold text-slate-900 min-w-0 break-words">{robot.execution_symbol || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Control Panel</h3>
            <RobotControlPanel 
              robotId={robot.id} 
              currentStatus={robot.status} 
              tradingEnabled={robot.trading_enabled}
              action="CONTROLS" 
            />
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
              <p><strong>Commands:</strong> START/STOP send async commands to the worker.</p>
              <p><strong>Archive:</strong> Disables the robot permanently via RPC.</p>
              <p><strong>Trading:</strong> Edit database to set trading_enabled=true.</p>
            </div>
          </div>
        
          <TestSignalButton 
            robotId={robot.id} 
            status={robot.status} 
            tradingMode={robot.trading_mode} 
          />
          
          <SignalPipelineMonitor robotId={robot.id} />

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Active Position
              </h3>
            </div>
            <div className="p-4">
              {!positions || positions.length === 0 ? (
                <p className="text-sm text-slate-500">No active positions.</p>
              ) : (
                <div className="space-y-4">
                  {positions.map((pos: any) => (
                    <div key={pos.id} className="flex flex-col gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-xs text-slate-500">PAPER TRADING</div>
                          <div className="font-bold text-slate-900 flex items-center gap-2 mt-1">
                            {pos.symbol}
                            <span className={`text-xs px-2 py-1 rounded ${pos.side === 'LONG' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{pos.side}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Unrealized PnL</div>
                          <div className={`font-semibold text-lg ${pos.unrealized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {pos.unrealized_pnl >= 0 ? '+' : ''}{pos.unrealized_pnl}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="block text-xs text-slate-500">Entry Price</span>
                          <span className="font-medium">{pos.entry_price}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500">Current Price</span>
                          <span className="font-medium text-slate-400">N/A (Current Candle Close)</span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500">Take Profit</span>
                          <span className="font-medium text-green-600">{pos.take_profit_price || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500">Stop Loss</span>
                          <span className="font-medium text-red-600">{pos.stop_loss_price || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500">Quantity</span>
                          <span className="font-medium">{pos.quantity}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500">Leverage</span>
                          <span className="font-medium">{pos.leverage}x</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-slate-800 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Robot Configuration (Strict)
                </h3>
                {configs?.[0]?.status && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    configs[0].status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                    configs[0].status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {configs[0].status}
                  </span>
                )}
              </div>
              {configs?.[0]?.status === 'PENDING' && (
                <RobotControlPanel
                  robotId={robot.id}
                  configId={configs[0].id}
                  action="APPLY_CONFIG"
                />
              )}
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider break-words">TradingView Symbol</div>
                  <div className="font-mono font-bold text-slate-900 break-words" title={robot.trading_view_symbol}>{robot.trading_view_symbol}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider break-words">Execution Symbol</div>
                  <div className="font-mono font-bold text-blue-600 break-words" title={robot.execution_symbol}>{robot.execution_symbol}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider break-words">Timeframe</div>
                  <div className="font-mono font-bold text-slate-900 uppercase break-words">{robot.timeframe}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider break-words">Strategy</div>
                  <div className="font-mono font-bold text-slate-900 break-words">{configs?.[0]?.strategy_profile?.type || 'N/A'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider break-words">Position Allocation</div>
                  <div className="font-mono font-bold text-emerald-600 break-words">
                    {configs?.[0]?.risk_profile?.position_allocation_percent 
                      ? `${configs[0].risk_profile.position_allocation_percent}% of balance`
                      : <span className="text-red-500 font-semibold">NOT CONFIGURED</span>}
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="text-xs text-slate-500 font-semibold mb-4 uppercase tracking-wider">Bollinger Bands (BB_MB) Configuration</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Length</div>
                    <div className="font-mono font-bold text-slate-900">{configs?.[0]?.indicator_profile?.length || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Source</div>
                    <div className="font-mono font-bold text-slate-900">{configs?.[0]?.indicator_profile?.source || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Multiplier 1</div>
                    <div className="font-mono font-bold text-slate-900">{configs?.[0]?.indicator_profile?.mult || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Multiplier 2</div>
                    <div className="font-mono font-bold text-slate-900">{configs?.[0]?.indicator_profile?.mult2 || 'N/A'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DIAGNOSTICS BLOCK */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center">
                <Activity className="w-4 h-4 mr-2" />
                Signal Diagnostics
              </h3>
            </div>
            <div className="p-6">
              {!robot.notification_profile?.diagnostics ? (
                <div className="text-slate-500 font-medium flex items-center justify-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                  NO WEBHOOK RECEIVED
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between items-center p-4 rounded-lg border border-slate-200 bg-slate-50">
                    <div>
                      <div className="text-xs text-slate-500 font-semibold mb-1 uppercase">Signal Result</div>
                      <div className={`font-bold ${robot.notification_profile.diagnostics.last_signal_result === 'SIGNAL DETECTED' ? 'text-emerald-600' : 'text-slate-600'}`}>
                        {robot.notification_profile.diagnostics.last_signal_result}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500 font-semibold mb-1 uppercase">Reason</div>
                      <div className="font-medium text-slate-900">{robot.notification_profile.diagnostics.last_signal_reason}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Last Webhook At</div>
                      <div className="font-mono text-sm font-medium">{new Date(robot.notification_profile.diagnostics.last_webhook_at).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Bar Timestamp</div>
                      <div className="font-mono text-sm font-medium">{new Date(robot.notification_profile.diagnostics.last_bar_timestamp).toLocaleString()}</div>
                    </div>
                    {robot.notification_profile.diagnostics.logic_eval && (
                      <div className="col-span-2 md:col-span-4 mt-4">
                        <div className="text-xs text-slate-500 mb-2 uppercase font-semibold">Logic Evaluation</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                             <div className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">LONG</div>
                             <div className="text-xs font-mono space-y-2">
                                <div className="flex justify-between"><span>C1 (prev &gt;= B5):</span> <span className={robot.notification_profile.diagnostics.logic_eval.long_c1 ? 'text-emerald-600 font-bold' : 'text-red-500'}>{String(robot.notification_profile.diagnostics.logic_eval.long_c1).toUpperCase()}</span></div>
                                <div className="flex justify-between"><span>C2 (prev &lt;= B4):</span> <span className={robot.notification_profile.diagnostics.logic_eval.long_c2 ? 'text-emerald-600 font-bold' : 'text-red-500'}>{String(robot.notification_profile.diagnostics.logic_eval.long_c2).toUpperCase()}</span></div>
                                <div className="flex justify-between"><span>C3 (curr &gt; B4):</span> <span className={robot.notification_profile.diagnostics.logic_eval.long_c3 ? 'text-emerald-600 font-bold' : 'text-red-500'}>{String(robot.notification_profile.diagnostics.logic_eval.long_c3).toUpperCase()}</span></div>
                                <div className="flex justify-between mt-3 pt-2 border-t border-slate-100 font-bold text-sm"><span>FINAL:</span> <span className={robot.notification_profile.diagnostics.logic_eval.long_final ? 'text-emerald-600' : 'text-red-500'}>{String(robot.notification_profile.diagnostics.logic_eval.long_final).toUpperCase()}</span></div>
                             </div>
                          </div>
                          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                             <div className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">SHORT</div>
                             <div className="text-xs font-mono space-y-2">
                                <div className="flex justify-between"><span>C1 (prev &gt;= B2):</span> <span className={robot.notification_profile.diagnostics.logic_eval.short_c1 ? 'text-emerald-600 font-bold' : 'text-red-500'}>{String(robot.notification_profile.diagnostics.logic_eval.short_c1).toUpperCase()}</span></div>
                                <div className="flex justify-between"><span>C2 (prev &lt;= B1):</span> <span className={robot.notification_profile.diagnostics.logic_eval.short_c2 ? 'text-emerald-600 font-bold' : 'text-red-500'}>{String(robot.notification_profile.diagnostics.logic_eval.short_c2).toUpperCase()}</span></div>
                                <div className="flex justify-between"><span>C3 (curr &lt; B2):</span> <span className={robot.notification_profile.diagnostics.logic_eval.short_c3 ? 'text-emerald-600 font-bold' : 'text-red-500'}>{String(robot.notification_profile.diagnostics.logic_eval.short_c3).toUpperCase()}</span></div>
                                <div className="flex justify-between mt-3 pt-2 border-t border-slate-100 font-bold text-sm"><span>FINAL:</span> <span className={robot.notification_profile.diagnostics.logic_eval.short_final ? 'text-emerald-600' : 'text-red-500'}>{String(robot.notification_profile.diagnostics.logic_eval.short_final).toUpperCase()}</span></div>
                             </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-xs text-slate-500 mb-3 font-semibold uppercase">Previous Snapshot</div>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <div><div className="text-[10px] text-slate-500 font-medium mb-1">Close</div><div className="font-mono text-xs">{robot.notification_profile.diagnostics.prev_snapshot?.close ?? 'N/A'}</div></div>
                        <div><div className="text-[10px] text-slate-500 font-medium mb-1">B1 (Upper)</div><div className="font-mono text-xs">{robot.notification_profile.diagnostics.prev_snapshot?.b1 ?? 'N/A'}</div></div>
                        <div><div className="text-[10px] text-slate-500 font-medium mb-1">B2 (Upper2)</div><div className="font-mono text-xs">{robot.notification_profile.diagnostics.prev_snapshot?.b2 ?? 'N/A'}</div></div>
                        <div><div className="text-[10px] text-slate-500 font-medium mb-1">B3 (Basis)</div><div className="font-mono text-xs">{robot.notification_profile.diagnostics.prev_snapshot?.b3 ?? 'N/A'}</div></div>
                        <div><div className="text-[10px] text-slate-500 font-medium mb-1">B4 (Lower2)</div><div className="font-mono text-xs">{robot.notification_profile.diagnostics.prev_snapshot?.b4 ?? 'N/A'}</div></div>
                        <div><div className="text-[10px] text-slate-500 font-medium mb-1">B5 (Lower)</div><div className="font-mono text-xs">{robot.notification_profile.diagnostics.prev_snapshot?.b5 ?? 'N/A'}</div></div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 border-l-4 border-l-blue-500">
                      <div className="text-xs text-blue-600 mb-3 font-semibold uppercase">Current Snapshot</div>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <div><div className="text-[10px] text-slate-500 font-medium mb-1">Close</div><div className="font-mono text-xs font-bold text-slate-900">{robot.notification_profile.diagnostics.curr_snapshot?.close ?? 'N/A'}</div></div>
                        <div><div className="text-[10px] text-slate-500 font-medium mb-1">B1 (Upper)</div><div className="font-mono text-xs">{robot.notification_profile.diagnostics.curr_snapshot?.b1 ?? 'N/A'}</div></div>
                        <div><div className="text-[10px] text-slate-500 font-medium mb-1">B2 (Upper2)</div><div className="font-mono text-xs">{robot.notification_profile.diagnostics.curr_snapshot?.b2 ?? 'N/A'}</div></div>
                        <div><div className="text-[10px] text-slate-500 font-medium mb-1">B3 (Basis)</div><div className="font-mono text-xs">{robot.notification_profile.diagnostics.curr_snapshot?.b3 ?? 'N/A'}</div></div>
                        <div><div className="text-[10px] text-slate-500 font-medium mb-1">B4 (Lower2)</div><div className="font-mono text-xs">{robot.notification_profile.diagnostics.curr_snapshot?.b4 ?? 'N/A'}</div></div>
                        <div><div className="text-[10px] text-slate-500 font-medium mb-1">B5 (Lower)</div><div className="font-mono text-xs">{robot.notification_profile.diagnostics.curr_snapshot?.b5 ?? 'N/A'}</div></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* END DIAGNOSTICS BLOCK */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 text-sm">Recent Intents</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {!intents || intents.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">No intents generated.</div>
                ) : (
                  intents.map((intent: any) => (
                    <div key={intent.id} className="p-4 text-sm flex justify-between">
                      <div>
                        <div className="font-medium">{intent.action} {intent.symbol}</div>
                        <div className="text-xs text-slate-400 break-words w-32">{intent.client_order_id}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold">{intent.status}</div>
                        <div className="text-xs text-slate-400">{new Date(intent.created_at).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 text-sm">Active Orders</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {!activeOrders || activeOrders.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">No active orders.</div>
                ) : (
                  activeOrders.map((order: any) => (
                    <div key={order.id} className="p-4 text-sm flex justify-between">
                      <div>
                        <div className="font-medium">{order.side} {order.quantity}</div>
                        <div className="text-xs text-slate-400">{order.status}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold">{order.average_fill_price || order.price || 'MKT'}</div>
                        <div className="text-xs text-slate-400">{new Date(order.created_at).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
          <TradeHistoryFilter robotId={resolvedParams.id} initialTrades={trades || []} />
      </div>
    </div>
  )
}
