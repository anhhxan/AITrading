'use client'

import { useState } from 'react'
import { addTradingAccount } from './actions'

export default function AccountForm() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError('')
    const result = await addTradingAccount(formData)
    setLoading(false)
    
    if (result.error) {
      setError(result.error)
    } else {
      // Reset form
      const form = document.getElementById('add-account-form') as HTMLFormElement
      form.reset()
    }
  }

  return (
    <form id="add-account-form" action={handleSubmit} className="space-y-4">
      {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}
      
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Account Label</label>
        <input 
          type="text" 
          name="name" 
          required 
          placeholder="e.g. Binance Main"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
        <select 
          name="provider" 
          required 
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
        >
          <option value="Binance">Binance</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
        <input 
          type="text" 
          name="apiKey" 
          required 
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none font-mono text-sm"
          placeholder="Paste API Key here"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">API Secret</label>
        <input 
          type="password" 
          name="apiSecret" 
          required 
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none font-mono text-sm"
          placeholder="Paste API Secret here"
        />
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Encrypting & Saving...' : 'Save Account'}
      </button>
    </form>
  )
}
