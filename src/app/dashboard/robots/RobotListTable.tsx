'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bot, ArrowUp, ArrowDown, Archive } from 'lucide-react'
import { swapRobotOrderAction, archiveRobotAction } from './actions'

export default function RobotListTable({ robots, pnlData }: { robots: any[], pnlData: Record<string, number> }) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const handleSwap = async (currentIndex: number, direction: 'up' | 'down') => {
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === robots.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const r1 = robots[currentIndex];
    const r2 = robots[swapIndex];

    const order1 = r1.display_order ?? currentIndex;
    const order2 = r2.display_order ?? swapIndex;

    setLoadingAction(`swap-${r1.id}`)
    const res = await swapRobotOrderAction(r1.id, order1, r2.id, order2)
    if (res.error) {
      alert(res.error)
    }
    setLoadingAction(null)
  }

  const handleArchive = async (robot: any) => {
    if (robot.status === 'RUNNING' || robot.trading_enabled) return;
    
    if (confirm(`Archive Robot này?\n\nTên: ${robot.name}\nTimeframe: ${robot.timeframe}\nMode: ${robot.trading_mode}\nBalance: $${robot.paper_balance}\nPnL: $${pnlData[robot.id] || 0}`)) {
      setLoadingAction(`archive-${robot.id}`)
      const res = await archiveRobotAction(robot.id)
      if (res.error) {
        alert(res.error)
      }
      setLoadingAction(null)
    }
  }

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
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-4 font-medium w-16">#</th>
              <th className="px-6 py-4 font-medium">Robot Name & Slug</th>
              <th className="px-6 py-4 font-medium">Lifecycle</th>
              <th className="px-6 py-4 font-medium">Trading</th>
              <th className="px-6 py-4 font-medium">Lời / Lỗ</th>
              <th className="px-6 py-4 font-medium">Heartbeat</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {robots.map((robot, idx) => {
              const pnl = pnlData[robot.id] || 0;
              const isRunning = robot.status === 'RUNNING';
              const canArchive = robot.trading_mode === 'PAPER' && !isRunning && !robot.trading_enabled;

              return (
                <tr key={robot.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <button 
                        onClick={() => handleSwap(idx, 'up')}
                        disabled={idx === 0 || loadingAction !== null}
                        className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400"
                        title="Move Up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <span className="text-xs font-semibold text-slate-600">{idx + 1}</span>
                      <button 
                        onClick={() => handleSwap(idx, 'down')}
                        disabled={idx === robots.length - 1 || loadingAction !== null}
                        className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400"
                        title="Move Down"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </td>
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
                        <div className="text-xs text-slate-500 mt-0.5">{robot.slug} • {robot.timeframe}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(robot.status)}
                    <div className="text-[10px] text-slate-500 mt-1">{robot.current_state || 'UNKNOWN'}</div>
                  </td>
                  <td className="px-6 py-4">
                    {getTradingBadge(robot.trading_enabled)}
                    <div className="text-[10px] font-medium text-slate-500 mt-1">{robot.trading_mode}</div>
                  </td>
                  <td className="px-6 py-4 font-semibold">
                    {pnl > 0 ? (
                      <span className="text-emerald-600">+${(pnl).toFixed(2)}</span>
                    ) : pnl < 0 ? (
                      <span className="text-red-600">-${Math.abs(pnl).toFixed(2)}</span>
                    ) : (
                      <span className="text-slate-500">$0.00</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {getHeartbeatStatus(robot.last_heartbeat_at)}
                    {robot.last_heartbeat_at && (
                      <div className="text-[10px] text-slate-400 mt-1">
                        {new Date(robot.last_heartbeat_at).toLocaleTimeString()}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link 
                        href={`/dashboard/robots/${robot.id}`}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleArchive(robot)}
                        disabled={!canArchive || loadingAction !== null}
                        title={!canArchive ? "Cannot archive (must be PAPER, STOPPED, trading OFF)" : "Archive Robot"}
                        className={`text-slate-400 hover:text-amber-600 p-1.5 rounded-md transition-colors ${!canArchive ? 'opacity-30 cursor-not-allowed hidden' : ''}`}
                      >
                        <Archive size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
