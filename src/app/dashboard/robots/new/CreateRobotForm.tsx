'use client'

import { useState } from 'react'
import { createRobot } from './actions'
import { Settings2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function CreateRobotForm({ accounts }: { accounts: { id: string, name: string }[] }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const formData = new FormData(e.currentTarget)
    const payload = {
      name: formData.get('name'),
      slug: formData.get('slug'),
      accountId: formData.get('accountId'),
      indicatorProfile: {
        length: parseInt(formData.get('indicatorLength') as string || '20'),
        source: formData.get('indicatorSource') as string || 'close',
        mult: 2.0,
        mult2: 1.0,
      },
      strategyProfile: { type: 'REVERSAL' },
      riskProfile: {
        max_position_size: parseFloat(formData.get('maxPositionSize') as string || '100'),
        stop_loss_pct: parseFloat(formData.get('stopLossPct') as string || '2.0')
      },
      entryProfile: { mode: 'MARKET' },
      exitProfile: { tp_mode: 'FIXED' }
    }

    try {
      const res = await fetch('/api/robots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create robot')
        setLoading(false)
      } else {
        router.push('/dashboard/robots')
      }
    } catch (err: any) {
      setError(err.message || 'Network error')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-200">{error}</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 border-b pb-2">General Information</h3>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Robot Name</label>
            <input 
              type="text" 
              name="name" 
              required 
              placeholder="e.g. BTC Scalper"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Unique Slug</label>
            <input 
              type="text" 
              name="slug" 
              required 
              placeholder="btc-scalper-01"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none font-mono text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">Must be unique across all your robots.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Trading Account</label>
            <select 
              name="accountId" 
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
            >
              <option value="">-- Select an account --</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 border-b pb-2 flex items-center">
            <Settings2 className="w-4 h-4 mr-2" /> Initial Configuration
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Indicator Length</label>
              <input 
                type="number" 
                name="indicatorLength" 
                defaultValue="20"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
              <select name="indicatorSource" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none">
                <option value="close">Close</option>
                <option value="open">Open</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Position Size ($)</label>
              <input 
                type="number" 
                name="maxPositionSize" 
                defaultValue="100"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stop Loss (%)</label>
              <input 
                type="number" 
                step="0.1"
                name="stopLossPct" 
                defaultValue="2.0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>
          </div>
          
          <div className="pt-2">
            <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
              A <strong>PENDING</strong> configuration will be created. You must manually Apply it after creation to make it ACTIVE.
            </p>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t flex justify-end">
        <button 
          type="submit" 
          disabled={loading}
          className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors font-medium shadow-sm"
        >
          {loading ? 'Creating...' : 'Create Robot'}
        </button>
      </div>
    </form>
  )
}
