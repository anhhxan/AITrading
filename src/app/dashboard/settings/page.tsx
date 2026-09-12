import { createClient } from '@/lib/supabase/server'
import { Settings, Shield, Bell } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your system preferences.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center mb-4">
            <Shield className="w-5 h-5 mr-2 text-indigo-600" />
            Paper Trading Environment
          </h3>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Authenticated Account</label>
              <input 
                type="text" 
                readOnly
                value={user.email} 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Trading Mode</label>
              <div className="w-full px-4 py-3 border border-blue-200 bg-blue-50 rounded-lg flex items-center">
                <div className="w-2 h-2 rounded-full bg-blue-600 mr-3"></div>
                <div>
                  <div className="font-bold text-blue-900 text-sm">PAPER ONLY</div>
                  <div className="text-xs text-blue-700 mt-0.5">Live trading is not supported in this environment.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center mb-2">
            <Bell className="w-5 h-5 mr-2 text-slate-500" />
            System Preferences
          </h3>
          <p className="text-sm text-slate-500">
            Một số tùy chọn hệ thống sẽ được bổ sung sau (Not implemented).
          </p>
        </div>
      </div>
    </div>
  )
}
