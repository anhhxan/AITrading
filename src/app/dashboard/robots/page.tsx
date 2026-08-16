import { createClient } from '@/lib/supabase/server'
import { Bot, Plus, Activity, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'

export default async function RobotsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: robots } = await supabase
    .from('robots')
    .select('*, trading_accounts(name)')
    .order('created_at', { ascending: false })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">RUNNING</span>;
      case 'STOPPED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">STOPPED</span>;
      case 'ARCHIVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">ARCHIVED</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{status}</span>;
    }
  };

  const getTradingBadge = (tradingEnabled: boolean) => {
    if (tradingEnabled) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">ON</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">PAUSED</span>;
  };

  const getHeartbeatStatus = (lastHeartbeat: string | null) => {
    if (!lastHeartbeat) {
      return <span className="text-xs text-slate-500">Worker not connected</span>;
    }
    const heartbeatTime = new Date(lastHeartbeat).getTime();
    const now = Date.now();
    if (now - heartbeatTime < 60000) {
      return <span className="text-xs text-emerald-600 font-medium">ONLINE</span>;
    }
    return <span className="text-xs text-red-600 font-medium">OFFLINE</span>;
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
          <Plus className="mr-2 h-4 w-4" />
          Create Robot
        </Link>
      </div>

      {!robots || robots.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center flex flex-col items-center justify-center">
          <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
            <Bot size={32} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No robots found</h3>
          <p className="text-slate-500 max-w-sm mb-6">You haven't created any trading robots yet. Create your first robot to start automating your trades.</p>
          <Link 
            href="/dashboard/robots/new"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 h-10 py-2 px-4"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Robot
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Robot Name & Slug</th>
                  <th className="px-6 py-4 font-medium">Lifecycle</th>
                  <th className="px-6 py-4 font-medium">Trading</th>
                  <th className="px-6 py-4 font-medium">Current State</th>
                  <th className="px-6 py-4 font-medium">Account</th>
                  <th className="px-6 py-4 font-medium">Heartbeat</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {robots.map((robot) => (
                  <tr key={robot.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <Bot size={16} />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">
                            <Link href={`/dashboard/robots/${robot.id}`} className="hover:underline hover:text-blue-600">
                              {robot.name}
                            </Link>
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{robot.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(robot.status)}
                    </td>
                    <td className="px-6 py-4">
                      {getTradingBadge(robot.trading_enabled)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Activity size={14} className="text-slate-400" />
                        <span className="text-xs font-medium text-blue-600">{robot.current_state}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700">{robot.trading_accounts?.name || 'Unassigned'}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getHeartbeatStatus(robot.last_heartbeat_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/dashboard/robots/${robot.id}`} className="text-slate-400 hover:text-slate-600 p-2 rounded-md hover:bg-slate-100 transition-colors">
                        <MoreHorizontal size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
