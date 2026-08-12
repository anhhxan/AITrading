import { createClient } from '@/lib/supabase/server'
import { List } from 'lucide-react'

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // RLS ensures they only see their own robots' audit logs
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*, robots(name)')
    .order('timestamp', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="text-sm text-slate-500 mt-1">Record of all significant robot state changes.</p>
      </div>

      {!logs || logs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center flex flex-col items-center justify-center">
          <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
            <List size={32} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No audit logs</h3>
          <p className="text-slate-500 max-w-sm mb-6">Audit logs will appear here once you interact with your robots.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Time</th>
                  <th className="px-6 py-4 font-medium">Robot</th>
                  <th className="px-6 py-4 font-medium">Command Type</th>
                  <th className="px-6 py-4 font-medium">State Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {log.robots?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4">
                      {log.command_type}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <span className="text-slate-400">{log.previous_state || 'NONE'}</span>
                      <span className="mx-2 text-slate-300">→</span>
                      <span className="font-medium text-slate-700">{log.requested_state}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
