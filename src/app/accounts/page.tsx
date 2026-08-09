'use client';

import { useEffect, useState } from 'react';
import { Shield, Plus, Wallet } from 'lucide-react';
import Link from 'next/link';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/accounts')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch accounts');
        return res.json();
      })
      .then(data => {
        setAccounts(data);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Trading Accounts</h2>
          <p className="text-sm text-slate-500 mt-1">Manage API keys and execution provider connections.</p>
        </div>
        <button 
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none bg-slate-900 text-white hover:bg-slate-800 h-10 py-2 px-4 opacity-50 cursor-not-allowed"
          title="Coming soon in UI-1B"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-white animate-pulse rounded-xl border border-slate-200" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
          Error: {error}
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center flex flex-col items-center justify-center">
          <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
            <Wallet size={32} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No trading accounts</h3>
          <p className="text-slate-500 max-w-sm mb-6">Connect an execution account like Binance or Exness to allow your robots to trade.</p>
          <button 
            disabled
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-slate-900 text-white hover:bg-slate-800 h-10 py-2 px-4 opacity-50 cursor-not-allowed"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map(account => (
            <div key={account.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                    {account.provider.substring(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{account.name}</h3>
                    <p className="text-xs text-slate-500">{account.provider}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${account.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                  {account.status}
                </span>
              </div>
              
              <div className="space-y-3 mt-6">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">API Key</p>
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-100 text-sm font-mono text-slate-700">
                    <Shield size={14} className="text-slate-400" />
                    {account.maskedApiKey}
                  </div>
                </div>
                
                <div>
                   <p className="text-xs font-medium text-slate-500 mb-1">API Secret</p>
                   <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-100 text-sm font-mono text-slate-700">
                    <Shield size={14} className="text-slate-400" />
                    ••••••••••••••••••••••••
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
