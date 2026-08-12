import { createClient } from '@/lib/supabase/server'
import { History } from 'lucide-react'

export default async function TradesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Since trades are out of scope for V1.1 (trade_history table doesn't exist in our core migration),
  // we just show an empty state. If it did exist, we would fetch it.
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Trade History</h1>
        <p className="text-sm text-slate-500 mt-1">Review past trades executed by your robots.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center flex flex-col items-center justify-center">
        <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
          <History size={32} />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">No trades found</h3>
        <p className="text-slate-500 max-w-sm mb-6">Your robots haven't executed any trades yet.</p>
      </div>
    </div>
  )
}
