import { createClient } from '@/lib/supabase/server'
import { Bot, Activity, Square, DollarSign, Clock, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  return `${Math.floor(diffInSeconds / 86400)} days ago`
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString()
}

export default async function DashboardOverview() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // 1. Fetch Robots
  const { data: robots, error: robotsError } = await supabase
    .from('robots')
    .select('id, status, slug')

  let runningRobots = 0
  let stoppedRobots = 0
  
  if (!robotsError && robots) {
    runningRobots = robots.filter(r => r.status === 'ACTIVE' || r.status === 'RUNNING').length
    stoppedRobots = robots.filter(r => r.status === 'STOPPED' || r.status === 'PAUSED').length
  }

  // 2. Fetch Active Positions
  const { data: activePositions, error: positionsError } = await supabase
    .from('active_positions')
    .select('*, robots(slug)')
    .order('created_at', { ascending: false })

  // 3. Fetch Robot Commands (Last Signals)
  const { data: lastCommands, error: commandsError } = await supabase
    .from('robot_commands')
    .select('*, robots(slug)')
    .eq('command_type', 'TV_SIGNAL')
    .order('created_at', { ascending: false })
    .limit(10)

  // Worker Activity (Last processed command)
  let lastCommandActivity = 'UNKNOWN'
  let isRecent = false
  
  if (!commandsError && lastCommands && lastCommands.length > 0) {
    const latestDate = new Date(lastCommands[0].created_at)
    lastCommandActivity = `Last processed ${formatTimeAgo(lastCommands[0].created_at)}`
    if (Date.now() - latestDate.getTime() < 300000) {
      isRecent = true
    }
  } else if (!commandsError && lastCommands?.length === 0) {
    lastCommandActivity = 'No recent command activity'
  }

  const getRobotSlug = (row: any) => {
      if (row.robots && !Array.isArray(row.robots) && row.robots.slug) {
          return row.robots.slug;
      }
      return row.robot_id;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paper Trading Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time overview of your sandbox trading environment.</p>
      </div>

      {/* ROW 1: Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg mr-4">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Last Command Activity</p>
            <p className={`text-lg font-bold ${isRecent ? 'text-green-600' : 'text-slate-900'}`}>
              {lastCommandActivity}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg mr-4">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Running Robots</p>
            <p className="text-2xl font-bold text-slate-900">{robotsError ? '--' : runningRobots}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg mr-4">
            <Square className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Stopped Robots</p>
            <p className="text-2xl font-bold text-slate-900">{robotsError ? '--' : stoppedRobots}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg mr-4">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Global PnL</p>
            <p className="text-lg font-bold text-slate-400">Data unavailable</p>
          </div>
        </div>
      </div>

      {/* ROW 2: ACTIVE POSITIONS */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-slate-900">ACTIVE POSITIONS</h3>
        </div>
        <div className="p-0 overflow-x-auto">
          {positionsError ? (
             <div className="p-6 text-red-500 flex items-center"><AlertCircle className="w-5 h-5 mr-2"/> Failed to load positions</div>
          ) : activePositions && activePositions.length > 0 ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-medium">Robot</th>
                  <th className="px-6 py-3 font-medium">Symbol</th>
                  <th className="px-6 py-3 font-medium">Side</th>
                  <th className="px-6 py-3 font-medium text-right">Quantity</th>
                  <th className="px-6 py-3 font-medium text-right">Entry Price</th>
                  <th className="px-6 py-3 font-medium text-right">Stop Loss</th>
                  <th className="px-6 py-3 font-medium text-right">Take Profit</th>
                  <th className="px-6 py-3 font-medium text-right">Opened At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activePositions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{getRobotSlug(pos)}</td>
                    <td className="px-6 py-4 text-slate-600">{pos.symbol || '--'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${pos.side === 'LONG' ? 'bg-green-100 text-green-700' : pos.side === 'SHORT' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                        {pos.side || '--'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-900">{pos.quantity || '--'}</td>
                    <td className="px-6 py-4 text-right text-slate-900">{pos.entry_price || '--'}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{pos.stop_loss_price || '--'}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{pos.take_profit_price || '--'}</td>
                    <td className="px-6 py-4 text-right text-slate-500">{pos.created_at ? formatTimeAgo(pos.created_at) : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-slate-500">
              <Square className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>0 Open Positions</p>
            </div>
          )}
        </div>
      </div>

      {/* ROW 3: RECENT TRADINGVIEW SIGNALS */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-900">RECENT TRADINGVIEW SIGNALS / EXECUTION</h3>
        </div>
        <div className="p-0 overflow-x-auto">
          {commandsError ? (
             <div className="p-6 text-red-500 flex items-center"><AlertCircle className="w-5 h-5 mr-2"/> Failed to load signals</div>
          ) : lastCommands && lastCommands.length > 0 ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-medium">Time</th>
                  <th className="px-6 py-3 font-medium">Robot</th>
                  <th className="px-6 py-3 font-medium">Action</th>
                  <th className="px-6 py-3 font-medium">Side</th>
                  <th className="px-6 py-3 font-medium text-right">Entry Price</th>
                  <th className="px-6 py-3 font-medium">Signal ID</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Execution Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lastCommands.map((cmd) => {
                  let payload = {} as any
                  let result = {} as any
                  try { if (cmd.payload) payload = typeof cmd.payload === 'string' ? JSON.parse(cmd.payload) : cmd.payload } catch(e) {}
                  try { if (cmd.result) result = typeof cmd.result === 'string' ? JSON.parse(cmd.result) : cmd.result } catch(e) {}
                  
                  const action = payload?.action || payload?.side || '--'
                  const side = payload?.side || '--'
                  const entryPrice = payload?.entry_price || '--'
                  const signalId = payload?.signal_id || '--'
                  
                  const getStatusColor = (status: string) => {
                      if (status === 'COMPLETED' || status === 'FILLED' || status === 'ACCEPTED' || status === 'SUCCEEDED') return 'bg-green-100 text-green-700'
                      if (status === 'FAILED' || status === 'REJECTED') return 'bg-red-100 text-red-700'
                      if (status === 'IGNORED' || status === 'TIMEOUT') return 'bg-orange-100 text-orange-700'
                      return 'bg-slate-100 text-slate-700'
                  }
                  
                  const getSideColor = (s: string) => {
                      if (s === 'LONG') return 'text-green-600 font-medium'
                      if (s === 'SHORT') return 'text-red-600 font-medium'
                      return 'text-slate-700'
                  }

                  let execResultStr = '--'
                  if (result && typeof result === 'object' && result.status) {
                     execResultStr = result.status
                     if (result.reason) execResultStr += `: ${result.reason}`
                  } else if (typeof result === 'string') {
                     execResultStr = result
                  }

                  return (
                    <tr key={cmd.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{formatDate(cmd.created_at)}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{getRobotSlug(cmd)}</td>
                      <td className="px-6 py-4 font-medium text-slate-700">{action}</td>
                      <td className={`px-6 py-4 ${getSideColor(side)}`}>{side}</td>
                      <td className="px-6 py-4 text-right text-slate-900">{entryPrice}</td>
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs">{signalId}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(cmd.status)}`}>
                          {cmd.status || 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{execResultStr}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-slate-500">
              <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>No recent signals found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
