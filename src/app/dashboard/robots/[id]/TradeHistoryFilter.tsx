'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTradeHistory } from './actions'

export default function TradeHistoryFilter({ robotId, initialTrades }: { robotId: string, initialTrades: any[] }) {
  const [trades, setTrades] = useState<any[]>(initialTrades)
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [visibleCount, setVisibleCount] = useState(10)

  const fetchTrades = useCallback(async () => {
    setLoading(true)
    let startIso = startDate ? new Date(startDate).toISOString() : undefined;
    let endIso = endDate ? new Date(endDate + 'T23:59:59.999Z').toISOString() : undefined;
    
    const res = await getTradeHistory(robotId, startIso, endIso)
    if (res.trades) {
      setTrades(res.trades)
      setVisibleCount(10) // Reset to 10 when filters change
    }
    setLoading(false)
  }, [robotId, startDate, endDate])

  useEffect(() => {
    if (startDate !== '' || endDate !== '') {
      fetchTrades()
    } else {
      fetchTrades()
    }
  }, [startDate, endDate, fetchTrades])

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 10)
  }

  const applyQuickFilter = (days: number | null, months: number | null = null) => {
    if (days === null && months === null) {
      // Clear filters -> All time
      setStartDate('')
      setEndDate('')
      return
    }

    const end = new Date()
    const start = new Date()

    if (days !== null) {
      start.setDate(end.getDate() - days)
    } else if (months !== null) {
      start.setMonth(end.getMonth() - months)
    }

    // Adjust for timezone offset to get correct local YYYY-MM-DD
    const formatDate = (date: Date) => {
      const offset = date.getTimezoneOffset()
      const adjustedDate = new Date(date.getTime() - (offset*60*1000))
      return adjustedDate.toISOString().split('T')[0]
    }

    setEndDate(formatDate(end))
    setStartDate(formatDate(start))
  }

  // Calculate summary over ALL fetched trades
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.pnl > 0).length;
  const losses = trades.filter(t => t.pnl <= 0).length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';
  const totalPnL = trades.reduce((acc, t) => acc + (t.pnl || 0), 0).toFixed(2);

  const visibleTrades = trades.slice(0, visibleCount);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-6">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h3 className="font-semibold text-slate-800">Trade History (Paper)</h3>
        
        <div className="flex flex-col items-end gap-2">
          {/* Date Pickers */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-500 font-medium uppercase mb-1">Từ ngày</label>
              <input 
                type="date" 
                className="text-sm border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-indigo-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-500 font-medium uppercase mb-1">Đến ngày</label>
              <input 
                type="date" 
                className="text-sm border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-indigo-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex gap-2 mt-1 flex-wrap justify-end">
            <button onClick={() => applyQuickFilter(7)} className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors">7 Ngày</button>
            <button onClick={() => applyQuickFilter(10)} className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors">10 Ngày</button>
            <button onClick={() => applyQuickFilter(null, 1)} className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors">1 Tháng</button>
            <button onClick={() => applyQuickFilter(null, 2)} className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors">2 Tháng</button>
            <button onClick={() => applyQuickFilter(null, null)} className="px-2 py-1 text-[11px] font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-md transition-colors">Tất cả</button>
          </div>
        </div>
      </div>

      {trades.length > 0 && (
        <div className="bg-slate-50 border-b border-slate-100 p-3 flex gap-6 text-sm">
          <div><span className="text-slate-500">Tổng lệnh:</span> <span className="font-semibold">{totalTrades}</span></div>
          <div><span className="text-slate-500">Win Rate:</span> <span className="font-semibold text-emerald-600">{winRate}%</span></div>
          <div>
            <span className="text-slate-500">Tổng PnL:</span> 
            <span className={`font-bold ml-1 ${Number(totalPnL) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {Number(totalPnL) > 0 ? '+' : ''}{totalPnL}
            </span>
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 animate-pulse">Đang tải dữ liệu...</div>
        ) : !trades || trades.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No trades found for selected period.</div>
        ) : (
          <>
            {visibleTrades.map((trade: any) => (
              <div key={trade.id} className="p-4 text-sm flex justify-between items-center hover:bg-slate-50 transition-colors">
                <div>
                  <div className="font-medium">{trade.action} {trade.amount} {trade.execution_symbol}</div>
                  <div className="text-xs text-slate-500 mt-1">Entry: {trade.entry_price || 'N/A'} | Exit: {trade.exit_price || 'N/A'}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Reason: <span className="font-semibold text-slate-600">{trade.reason || 'UNKNOWN'}</span>
                    {' • '}
                    Snapshot: <span className="font-semibold text-slate-600">{trade.execution_symbol} | {trade.timeframe || '15'}M | BB {trade.indicator_snapshot?.config?.length || '20'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${trade.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    PnL: {trade.pnl > 0 ? '+' : ''}{Number(trade.pnl || 0).toFixed(4)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{new Date(trade.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
            
            {visibleCount < trades.length && (
              <div className="p-4 flex justify-center bg-white sticky bottom-0 border-t border-slate-100 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                <button 
                  onClick={handleLoadMore}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                >
                  Xem thêm ({trades.length - visibleCount} lệnh nữa)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
