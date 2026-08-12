import { createClient } from '@/lib/supabase/server'
import { Bot, Play, Square, Archive, Activity, FileText, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import RobotControlPanel from './RobotControlPanel'

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
      <div className="flex justify-between items-start">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center">
                <Activity className="w-4 h-4 mr-2" />
                Status Overview
              </h3>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-5 gap-6">
              <div>
                <p className="text-xs text-slate-500 mb-1">Lifecycle Status</p>
                <p className="font-semibold text-slate-900">{robot.status}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Trading Mode</p>
                <p className="font-semibold text-slate-900">{robot.trading_mode || 'PAPER'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Paper Balance</p>
                <p className="font-semibold text-blue-600">${Number(robot.paper_balance || 10000).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Trading Enabled</p>
                <p className="font-semibold text-slate-900">{robot.trading_enabled ? <span className="text-emerald-600">ON</span> : <span className="text-red-500">OFF</span>}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Symbol</p>
                <p className="font-semibold text-slate-900">{robot.execution_symbol || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
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
                    <div key={pos.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
                      <div>
                        <div className="font-bold text-slate-900">{pos.symbol} <span className={`text-xs px-2 py-1 rounded ${pos.side === 'LONG' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{pos.side}</span></div>
                        <div className="text-sm text-slate-500 mt-1">Qty: {pos.quantity} @ {pos.entry_price}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Unrealized PnL</div>
                        <div className={`font-semibold ${pos.unrealized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {pos.unrealized_pnl >= 0 ? '+' : ''}{pos.unrealized_pnl}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <div className="text-xs text-slate-400 truncate w-32">{intent.client_order_id}</div>
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
          
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Trade History (Paper)</h3>
            </div>
            <div className="divide-y divide-slate-100">
                {!trades || trades.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">No trades yet.</div>
                ) : (
                  trades.map((trade: any) => (
                    <div key={trade.id} className="p-4 text-sm flex justify-between">
                      <div>
                        <div className="font-medium">{trade.action} {trade.amount} {robot.execution_symbol}</div>
                        <div className="text-xs text-slate-400">@ {trade.entry_price || trade.exit_price}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold">PnL: {trade.pnl || 0}</div>
                        <div className="text-xs text-slate-400">{new Date(trade.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))
                )}
            </div>
          </div>
        </div>

        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Control Panel</h3>
            <RobotControlPanel robotId={robot.id} currentStatus={robot.status} action="CONTROLS" />
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
              <p><strong>Commands:</strong> START/STOP send async commands to the worker.</p>
              <p><strong>Archive:</strong> Disables the robot permanently via RPC.</p>
              <p><strong>Trading:</strong> Edit database to set trading_enabled=true.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
