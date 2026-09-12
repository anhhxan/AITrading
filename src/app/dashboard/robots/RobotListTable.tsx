'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUp, ArrowDown, Archive, Activity } from 'lucide-react'
import { updateRobotOrdersAction, archiveRobotAction } from './actions'

export default function RobotListTable({ 
  robots, 
  pnlData, 
  activePositions, 
  lastSignals 
}: { 
  robots: any[], 
  pnlData: Record<string, number | 'ERROR'>, 
  activePositions: Record<string, string | 'ERROR'>,
  lastSignals: Record<string, any | 'ERROR'>
}) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const handleSwap = async (currentIndex: number, direction: 'up' | 'down') => {
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === robots.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newOrder = [...robots];
    [newOrder[currentIndex], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[currentIndex]];
    const updates = newOrder.map((r, idx) => ({ id: r.id, order: idx }));

    setLoadingAction(`swap-${robots[currentIndex].id}`)
    const res = await updateRobotOrdersAction(updates)
    if (res.error) {
      alert(res.error)
    }
    setLoadingAction(null)
  }

  const handleArchive = async (robot: any) => {
    if (robot.status === 'RUNNING') {
       alert('Không thể Archive Robot đang RUNNING. Vui lòng Stop trước.');
       return;
    }
    
    if (confirm(`Bạn có chắc muốn Archive Robot này?\n\nTên: ${robot.name}\nSymbol: ${robot.symbol}\n\nRobot đã bị Archive sẽ bị ẩn khỏi danh sách.`)) {
      setLoadingAction(`archive-${robot.id}`)
      const res = await archiveRobotAction(robot.id)
      if (res.error) {
        alert(res.error)
      }
      setLoadingAction(null)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-4 font-medium w-16 text-center">#</th>
              <th className="px-6 py-4 font-medium">Robot</th>
              <th className="px-6 py-4 font-medium">Mode & Status</th>
              <th className="px-6 py-4 font-medium">Position</th>
              <th className="px-6 py-4 font-medium">Last Signal</th>
              <th className="px-6 py-4 font-medium text-right">Realized PnL</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {robots.map((robot, idx) => {
              
              // 1. Lifecycle Status
              const isRunning = robot.status === 'RUNNING';

              // 2. Position State
              const posData = activePositions[robot.id];
              let posBadge = <span className="text-slate-500 font-bold">FLAT</span>;
              if (posData === 'ERROR') {
                posBadge = <span className="text-red-500 text-xs">Error</span>;
              } else if (posData === 'LONG') {
                posBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">LONG</span>;
              } else if (posData === 'SHORT') {
                posBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">SHORT</span>;
              }

              // 3. Realized PnL
              const pnl = pnlData[robot.id];
              let pnlDisplay = <span className="text-slate-400">No trades yet</span>;
              if (pnl === 'ERROR') {
                pnlDisplay = <span className="text-red-500 text-xs">Error</span>;
              } else if (typeof pnl === 'number') {
                if (pnl > 0) {
                  pnlDisplay = <span className="text-green-600 font-bold">+${pnl.toFixed(2)} USDT</span>;
                } else if (pnl < 0) {
                  pnlDisplay = <span className="text-red-600 font-bold">-${Math.abs(pnl).toFixed(2)} USDT</span>;
                } else {
                  pnlDisplay = <span className="text-slate-600 font-bold">0.00 USDT</span>;
                }
              }

              // 4. Last Signal
              const sigData = lastSignals[robot.id];
              let sigDisplay = <span className="text-slate-400 text-xs">No signal yet</span>;
              if (sigData === 'ERROR') {
                sigDisplay = <span className="text-red-500 text-xs">Error</span>;
              } else if (sigData) {
                let action = '—';
                try {
                  const payload = typeof sigData.payload === 'string' ? JSON.parse(sigData.payload) : sigData.payload;
                  action = payload?.action || payload?.side || 'UNKNOWN';
                } catch(e) {}
                
                let actionColor = 'text-slate-700';
                if (action.includes('LONG')) actionColor = 'text-green-600';
                if (action.includes('SHORT')) actionColor = 'text-red-600';

                sigDisplay = (
                  <div className="flex flex-col">
                    <span className={`font-bold text-xs ${actionColor}`}>{action}</span>
                    <span className="text-[10px] text-slate-500">{formatDate(sigData.created_at)}</span>
                  </div>
                );
              }

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
                    <div className="font-bold text-slate-800 mb-0.5">
                      <Link href={`/dashboard/robots/${robot.id}`} className="hover:underline hover:text-blue-600">
                        {robot.name}
                      </Link>
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      {robot.symbol || '—'} · {robot.timeframe || '—'}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5 items-start">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-blue-100 text-blue-700">
                        {robot.trading_mode || 'PAPER'}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${isRunning ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
                        {robot.status || 'UNKNOWN'}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    {posBadge}
                  </td>
                  
                  <td className="px-6 py-4">
                    {sigDisplay}
                  </td>
                  
                  <td className="px-6 py-4 text-right">
                    {pnlDisplay}
                  </td>
                  
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link 
                        href={`/dashboard/robots/${robot.id}`}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-bold"
                      >
                        VIEW
                      </Link>
                      <button
                        onClick={() => handleArchive(robot)}
                        disabled={isRunning || loadingAction !== null}
                        title={isRunning ? "Cannot archive RUNNING robot" : "Archive Robot"}
                        className={`text-slate-400 hover:text-amber-600 p-1.5 rounded-md transition-colors ${isRunning ? 'opacity-30 cursor-not-allowed hidden' : ''}`}
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
