'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTradeHistory } from './actions'

export default function TradeHistoryFilter({ robotId, initialTrades }: { robotId: string, initialTrades: any[] }) {
  const [trades, setTrades] = useState<any[]>(initialTrades)
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchTrades = useCallback(async () => {
    setLoading(true)
    // Convert local dates to ISO strings for Supabase range if needed
    // Simple approach: YYYY-MM-DD
    let startIso = startDate ? new Date(startDate).toISOString() : undefined;
    let endIso = endDate ? new Date(endDate + 'T23:59:59.999Z').toISOString() : undefined;
    
    const res = await getTradeHistory(robotId, startIso, endIso)
    if (res.trades) {
      setTrades(res.trades)
    }
    setLoading(false)
  }, [robotId, startDate, endDate])

  useEffect(() => {
    // If user clears filters, reload defaults or just apply empty filters
    if (startDate !== '' || endDate !== '') {
      fetchTrades()
    } else {
      // fallback to initial if both cleared? Or just fetch last 100
      fetchTrades()
    }
  }, [startDate, endDate, fetchTrades])

  // Calculate summary
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.pnl > 0).length;
  const losses = trades.filter(t => t.pnl <= 0).length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';
  const totalPnL = trades.reduce((acc, t) => acc + (t.pnl || 0), 0).toFixed(2);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-6">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h3 className="font-semibold text-slate-800">Trade History (Paper)</h3>
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
          trades.map((trade: any) => (
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
          ))
        )}
      </div>
    </div>
  )
}
