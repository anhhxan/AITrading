'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, AlertTriangle, Bot, ArrowRight, ArrowLeft } from 'lucide-react'

export default function CreateRobotForm({ accounts }: { accounts: { id: string, name: string }[] }) {
  const router = useRouter()
  
  // Wizard State
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form Data State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    timeframe: '15m',
    tradingViewSymbol: 'BINANCE:BTCUSDT',
    executionSymbol: 'BTCUSDT',
    positionAllocationPercent: 20
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Navigation Handlers
  const handleNext = () => {
    setError('')
    // Validation for Step 1
    if (step === 1) {
      if (!formData.name.trim()) return setError('Robot Name is required')
      if (!formData.slug.trim()) return setError('Unique Slug is required')
      // Basic slug validation
      if (!/^[a-z0-9-]+$/.test(formData.slug)) return setError('Slug can only contain lowercase letters, numbers, and hyphens')
    }
    // Validation for Step 2
    if (step === 2) {
      if (!formData.tradingViewSymbol.trim()) return setError('TradingView Symbol is required')
      if (!formData.executionSymbol.trim()) return setError('Execution Symbol is required')
    }
    // Validation for Step 3
    if (step === 3) {
      const alloc = Number(formData.positionAllocationPercent)
      if (isNaN(alloc) || alloc <= 0 || alloc > 100) return setError('Allocation must be between 0.1 and 100')
    }
    
    setStep(s => Math.min(s + 1, 4))
  }

  const handleBack = () => {
    setError('')
    setStep(s => Math.max(s - 1, 1))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    const payload = {
      name: formData.name.trim(),
      slug: formData.slug.trim(),
      timeframe: formData.timeframe,
      tradingViewSymbol: formData.tradingViewSymbol.trim().toUpperCase(),
      executionSymbol: formData.executionSymbol.trim().toUpperCase(),
      provider: 'BINANCE', // Default required by backend
      signalSource: 'TRADINGVIEW', // Legacy backend default
      tradingMode: 'PAPER', // Enforce PAPER
      accountId: null, // Paper doesn't strictly need account ID for now
      riskProfile: {
        position_allocation_percent: Number(formData.positionAllocationPercent)
        // Stop loss omitted, fallback to backend default
      }
      // Indicator, Strategy, Exit profiles omitted, fallback to backend default
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
        // Success -> redirect to detail
        router.push(`/dashboard/robots/${data.robot.id}`)
      }
    } catch (err: any) {
      setError(err.message || 'Network error')
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Wizard Header / Steps */}
      <div className="flex items-center justify-between mb-8 overflow-hidden rounded-lg bg-slate-50 border border-slate-200">
        <div className={`flex-1 py-3 text-center text-xs font-bold ${step >= 1 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>1. Identity</div>
        <div className="w-px h-full bg-white/20"></div>
        <div className={`flex-1 py-3 text-center text-xs font-bold ${step >= 2 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>2. Integration</div>
        <div className="w-px h-full bg-white/20"></div>
        <div className={`flex-1 py-3 text-center text-xs font-bold ${step >= 3 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>3. Paper Settings</div>
        <div className="w-px h-full bg-white/20"></div>
        <div className={`flex-1 py-3 text-center text-xs font-bold ${step >= 4 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>4. Review</div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-start">
          <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* FORM BODY */}
      <div className="min-h-[250px]">
        {/* STEP 1: IDENTITY */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">Robot Name <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="name" 
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. BTC Scalper"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-shadow"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">Unique Slug <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="slug" 
                value={formData.slug}
                onChange={handleChange}
                placeholder="btc-scalper-01"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-shadow font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">Lowercase letters, numbers, and hyphens only. Must be unique.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">Timeframe <span className="text-red-500">*</span></label>
              <select 
                name="timeframe" 
                value={formData.timeframe}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-shadow"
              >
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="30m">30m</option>
                <option value="1h">1h</option>
                <option value="4h">4h</option>
                <option value="1d">1d</option>
              </select>
            </div>
          </div>
        )}

        {/* STEP 2: INTEGRATION */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">TradingView Symbol <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="tradingViewSymbol" 
                value={formData.tradingViewSymbol}
                onChange={handleChange}
                placeholder="BINANCE:BTCUSDT"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-shadow font-mono text-sm uppercase"
              />
              <p className="text-xs text-slate-500 mt-1">Format: EXCHANGE:PAIR. Must match your Pine script settings.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">Execution Symbol <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="executionSymbol" 
                value={formData.executionSymbol}
                onChange={handleChange}
                placeholder="BTCUSDT"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-shadow font-mono text-sm uppercase"
              />
              <p className="text-xs text-slate-500 mt-1">The symbol used on the execution exchange.</p>
            </div>
          </div>
        )}

        {/* STEP 3: PAPER SETTINGS */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">Trading Mode</label>
              <div className="w-full px-4 py-3 border border-blue-200 bg-blue-50 rounded-lg flex items-center">
                <div className="w-2 h-2 rounded-full bg-blue-600 mr-3"></div>
                <div>
                  <div className="font-bold text-blue-900 text-sm">PAPER ONLY</div>
                  <div className="text-xs text-blue-700 mt-0.5">Live trading is not supported through this wizard.</div>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">Position Allocation (%) <span className="text-red-500">*</span></label>
              <input 
                type="number" 
                name="positionAllocationPercent" 
                value={formData.positionAllocationPercent}
                onChange={handleChange}
                min="0.1" max="100" step="0.1"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-shadow"
              />
              <p className="text-xs text-slate-500 mt-1">Percentage of paper balance to allocate per trade.</p>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW */}
        {step === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
               <div className="px-5 py-4 border-b border-slate-200 bg-slate-100 flex items-center justify-between">
                 <h3 className="font-bold text-slate-800 flex items-center"><Bot className="w-4 h-4 mr-2 text-indigo-600" /> Robot Configuration Summary</h3>
               </div>
               <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                 <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">Robot Name</span>
                    <span className="font-semibold text-slate-900">{formData.name}</span>
                 </div>
                 <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">Slug</span>
                    <span className="font-mono text-slate-900">{formData.slug}</span>
                 </div>
                 <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">TradingView Symbol</span>
                    <span className="font-mono text-slate-900">{formData.tradingViewSymbol.toUpperCase()}</span>
                 </div>
                 <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">Execution Symbol</span>
                    <span className="font-mono text-slate-900">{formData.executionSymbol.toUpperCase()}</span>
                 </div>
                 <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">Timeframe</span>
                    <span className="font-semibold text-slate-900">{formData.timeframe}</span>
                 </div>
                 <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">Position Allocation</span>
                    <span className="font-semibold text-slate-900">{formData.positionAllocationPercent}%</span>
                 </div>
                 <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">Trading Mode</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-blue-100 text-blue-700">PAPER</span>
                 </div>
               </div>
            </div>
            
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-amber-800 text-sm">
              <strong>Note:</strong> Webhook configuration instructions will be available in the Diagnostics tab after creation.
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="pt-8 mt-4 border-t border-slate-200 flex items-center justify-between">
        <button 
          type="button"
          onClick={handleBack}
          disabled={step === 1 || loading}
          className="px-4 py-2.5 rounded-lg font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 flex items-center transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </button>

        {step < 4 ? (
          <button 
            type="button"
            onClick={handleNext}
            className="px-6 py-2.5 rounded-lg font-medium bg-slate-900 text-white hover:bg-slate-800 flex items-center transition-colors"
          >
            Next <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        ) : (
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-2.5 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-700 flex items-center shadow-sm disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Create Robot'} <Check className="w-4 h-4 ml-2" />
          </button>
        )}
      </div>
    </div>
  )
}
