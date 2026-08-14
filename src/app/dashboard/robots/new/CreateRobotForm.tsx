'use client'

import { useState } from 'react'
import { Settings2, Globe, ShieldAlert } from 'lucide-react'
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
    
    // Validate required fields explicitly
    const requiredFields = ['name', 'slug', 'tradingViewSymbol', 'executionSymbol', 'timeframe', 'signalSource', 'provider']
    for (const field of requiredFields) {
      if (!formData.get(field)?.toString().trim()) {
        setError(`${field} is required.`)
        setLoading(false)
        return
      }
    }

    const payload = {
      name: formData.get('name'),
      slug: formData.get('slug'),
      accountId: formData.get('accountId') || null,
      provider: formData.get('provider'),
      tradingViewSymbol: formData.get('tradingViewSymbol'),
      executionSymbol: formData.get('executionSymbol'),
      timeframe: formData.get('timeframe'),
      signalSource: formData.get('signalSource'),
      tradingMode: formData.get('tradingMode'),
      indicatorProfile: {
        length: parseInt(formData.get('indicatorLength') as string || '20'),
        source: formData.get('indicatorSource') as string || 'close',
        mult: parseFloat(formData.get('indicatorMult') as string || '2.0'),
        mult2: parseFloat(formData.get('indicatorMult2') as string || '1.0'),
      },
      strategyProfile: { type: 'REVERSAL' },
      riskProfile: {
        max_position_size: parseFloat(formData.get('maxPositionSize') as string || '100'),
        stop_loss_pct: parseFloat(formData.get('stopLossPct') as string || '2.0')
      },
      entryProfile: { mode: 'MARKET' },
      exitProfile: { tp_mode: 'FIXED' },
      notificationProfile: {},
      tradingSession: '24/7'
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
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && <div className="text-red-500 text-sm bg-red-50 p-4 rounded-lg border border-red-200">{error}</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column */}
        <div className="space-y-6">
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
              <select 
                name="provider" 
                required
                defaultValue="BINANCE"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
              >
                <option value="BINANCE">Binance</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Trading Account</label>
              <select 
                name="accountId" 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
              >
                <option value="">-- No Account (Paper Trading Only) --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 border-b pb-2 flex items-center">
              <Settings2 className="w-4 h-4 mr-2" /> Indicator Configuration
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Length</label>
                <input 
                  type="number" 
                  name="indicatorLength" 
                  defaultValue="20"
                  required
                  min="1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
                <select name="indicatorSource" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none">
                  <option value="close">Close</option>
                  <option value="open">Open</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mult</label>
                <input 
                  type="number" 
                  step="0.1"
                  name="indicatorMult" 
                  defaultValue="2.0"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mult2</label>
                <input 
                  type="number" 
                  step="0.1"
                  name="indicatorMult2" 
                  defaultValue="1.0"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 border-b pb-2 flex items-center">
              <Globe className="w-4 h-4 mr-2" /> Market & Signal
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">TradingView Symbol</label>
                <input 
                  type="text" 
                  name="tradingViewSymbol" 
                  required
                  placeholder="BINANCE:BTCUSDT"
                  defaultValue="BINANCE:BTCUSDT"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none font-mono text-sm uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Execution Symbol</label>
                <input 
                  type="text" 
                  name="executionSymbol" 
                  required
                  placeholder="BTCUSDT"
                  defaultValue="BTCUSDT"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none font-mono text-sm uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Timeframe</label>
                <select 
                  name="timeframe" 
                  required
                  defaultValue="15m"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                >
                  <option value="1m">1m</option>
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                  <option value="4h">4h</option>
                  <option value="1d">1d</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Signal Source</label>
                <select 
                  name="signalSource" 
                  required
                  defaultValue="TRADINGVIEW"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                >
                  <option value="TRADINGVIEW">TradingView Webhook</option>
                  <option value="INTERNAL">Internal Engine</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Trading Mode</label>
              <select 
                name="tradingMode" 
                required
                defaultValue="PAPER"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
              >
                <option value="PAPER">Paper Trading (Simulated)</option>
                <option value="LIVE">Live Trading (Real Funds)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 border-b pb-2 flex items-center">
              <ShieldAlert className="w-4 h-4 mr-2" /> Risk Profile
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Max Position Size ($)</label>
                <input 
                  type="number" 
                  name="maxPositionSize" 
                  required
                  min="1"
                  step="0.01"
                  defaultValue="100"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Stop Loss (%)</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0.1"
                  name="stopLossPct" 
                  required
                  defaultValue="2.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                />
              </div>
            </div>
            
            <div className="pt-2">
              <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-200">
                A <strong>PENDING</strong> configuration will be created. You must manually Apply it after creation to make it ACTIVE.
              </p>
            </div>
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
