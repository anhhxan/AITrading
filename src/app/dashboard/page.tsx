import { createClient } from '@/lib/supabase/server'
import { Bot, Wallet, Activity, ArrowUpRight, Square } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardOverview() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch counts
  const { count: totalRobots } = await supabase
    .from('robots')
    .select('*', { count: 'exact', head: true })
    
  const { count: runningRobots } = await supabase
    .from('robots')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'RUNNING')

  const { count: totalAccounts } = await supabase
    .from('trading_accounts')
    .select('*', { count: 'exact', head: true })

  const { count: stoppedRobots } = await supabase
    .from('robots')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'STOPPED')

  const { count: idleRobots } = await supabase
    .from('robots')
    .select('*', { count: 'exact', head: true })
    .in('status', ['CREATED', 'ARCHIVED'])

  const { data: latestHeartbeat } = await supabase
    .from('core_events')
    .select('created_at')
    .eq('event_type', 'WORKER_HEARTBEAT')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  let workerStatus = 'OFFLINE';
  let isWorkerOnline = false;
  if (latestHeartbeat) {
    const heartbeatTime = new Date(latestHeartbeat.created_at).getTime();
    if (Date.now() - heartbeatTime < 60000) {
      workerStatus = 'ONLINE';
      isWorkerOnline = true;
    }
  }

  const stats = [
    { name: 'Total Robots', value: totalRobots || 0, icon: Bot },
    { name: 'Running Robots', value: runningRobots || 0, icon: Activity },
    { name: 'Stopped/Idle', value: (stoppedRobots || 0) + (idleRobots || 0), icon: Square },
    { name: 'Worker Status', value: workerStatus, icon: isWorkerOnline ? Activity : Square, highlight: isWorkerOnline ? 'text-green-600' : 'text-red-600' }
  ]

  const hasNoData = totalRobots === 0 && totalAccounts === 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of your automated trading operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg mr-4">
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                <p className={`text-2xl font-bold ${stat.highlight || 'text-slate-900'}`}>{stat.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {hasNoData ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center flex flex-col items-center">
          <Bot className="w-16 h-16 text-slate-300 mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">No trading robots yet</h2>
          <p className="text-slate-500 max-w-md mb-6">
            Get started by adding a Binance trading account, then create your first automated trading robot.
          </p>
          <div className="flex gap-4">
            <Link href="/dashboard/trading-accounts" className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Add Trading Account
            </Link>
            <Link href="/dashboard/robots/new" className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
              Create Robot
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-900">Recent Events</h3>
              <Link href="/dashboard/events" className="text-sm text-blue-600 hover:underline">View all</Link>
            </div>
            <p className="text-sm text-slate-500 italic">No recent events</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-900">Recent Trades</h3>
              <Link href="/dashboard/trades" className="text-sm text-blue-600 hover:underline">View all</Link>
            </div>
            <p className="text-sm text-slate-500 italic">No recent trades</p>
          </div>
        </div>
      )}
    </div>
  )
}
