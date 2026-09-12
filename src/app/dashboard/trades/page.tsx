import { createClient } from '@/lib/supabase/server'
import { History, AlertTriangle } from 'lucide-react'

export default async function TradesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch from trade_history joining robots
  const { data: trades, error } = await supabase
    .from('trade_history')
    .select('*, robots(name)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Trade History</h1>
        <p className="text-sm text-slate-500 mt-1">Review past trades executed by your robots in Paper mode.</p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center text-red-700">
          <AlertTriangle className="w-5 h-5 mr-3" />
          <span>Không thể tải Trade History: {error.message}</span>
        </div>
      ) : !trades || trades.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center flex flex-col items-center justify-center shadow-sm">
          <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
            <History size={32} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Chưa có giao dịch Paper nào được đóng.</h3>
          <p className="text-slate-500 max-w-sm mb-6">Lịch sử giao dịch sẽ xuất hiện tại đây khi vị thế được đóng.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Time</th>
                  <th className="px-6 py-4 font-medium">Robot</th>
                  <th className="px-6 py-4 font-medium">Symbol</th>
                  <th className="px-6 py-4 font-medium">Side</th>
                  <th className="px-6 py-4 font-medium text-right">Entry</th>
                  <th className="px-6 py-4 font-medium text-right">Exit</th>
                  <th className="px-6 py-4 font-medium text-right">Net PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trades.map((trade) => {
                  const pnl = Number(trade.pnl) || 0;
                  const fee = Number(trade.fee) || 0;
                  const netPnl = pnl - fee;
                  const isProfit = netPnl > 0;
                  const isLoss = netPnl < 0;

                  return (
                    <tr key={trade.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-xs">
                        {new Date(trade.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {trade.robots?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 font-mono font-medium text-slate-700">
                        {trade.execution_symbol}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                          trade.side === 'LONG' ? 'bg-emerald-100 text-emerald-700' : 
                          trade.side === 'SHORT' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-600 text-right">
                        {Number(trade.entry_price).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-600 text-right">
                        {Number(trade.exit_price).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-mono text-right">
                        <span className={`font-semibold ${isProfit ? 'text-emerald-600' : isLoss ? 'text-rose-600' : 'text-slate-600'}`}>
                          {isProfit ? '+' : ''}{netPnl.toFixed(2)}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">Fee: {fee.toFixed(2)}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
