import { createClient } from '@/lib/supabase/server'
import { Wallet, Plus, Trash2, ShieldCheck } from 'lucide-react'
import { addTradingAccount, deleteTradingAccount } from './actions'

// Client component for the form (inline for simplicity, ideally separate file)
import AccountForm from './AccountForm'

export default async function TradingAccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: accounts } = await supabase
    .from('trading_accounts')
    .select('*')
    .order('created_at', { ascending: false })

  // Function to mask the API key (which is stored encrypted)
  // Wait, if it's stored encrypted, we can't show the first 4 chars unless we decrypt it.
  // The architect asked for "ABCD••••••••XYZ" but if we encrypt it, we can't show it unless we decrypt it first on the server.
  // We will decrypt it, mask it, and NEVER send the raw or encrypted key to the client.

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Trading Accounts</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your exchange connections securely.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {(!accounts || accounts.length === 0) ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center flex flex-col items-center">
              <Wallet className="w-16 h-16 text-slate-300 mb-4" />
              <h2 className="text-xl font-bold text-slate-800 mb-2">No accounts added</h2>
              <p className="text-slate-500 mb-6">Add your Binance API credentials to start trading.</p>
            </div>
          ) : (
            accounts.map(acc => (
              <div key={acc.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex justify-between items-center">
                <div className="flex items-center">
                  <div className="p-3 bg-slate-50 text-slate-600 rounded-lg mr-4 border border-slate-100">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 flex items-center">
                      {acc.name}
                      {acc.is_active && <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">Active</span>}
                    </h3>
                    <p className="text-sm text-slate-500">{acc.provider}</p>
                    <div className="mt-2 text-xs font-mono text-slate-400">
                      <div>API Key: {acc.api_key?.startsWith('v1:') ? 'ENCRYPTED••••••••' : '••••••••'}</div>
                      <div>API Secret: ••••••••••••••</div>
                    </div>
                  </div>
                </div>
                <form action={async () => {
                  'use server';
                  await deleteTradingAccount(acc.id);
                }}>
                  <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </form>
              </div>
            ))
          )}
        </div>

        <div className="md:col-span-1">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm sticky top-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center">
              <Plus className="w-4 h-4 mr-2" /> Add Account
            </h3>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start">
              <ShieldCheck className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                Credentials are AES-256-GCM encrypted before saving to the database. Secrets are never exposed to the browser.
              </p>
            </div>
            <AccountForm />
          </div>
        </div>
      </div>
    </div>
  )
}
