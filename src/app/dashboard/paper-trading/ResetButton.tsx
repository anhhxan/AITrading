'use client'

import { useState } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ResetButton({ robotId, disabled }: { robotId: string, disabled: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleReset = async () => {
    if (disabled) return
    const confirmed = confirm('⚠ This will delete all paper positions, orders and trade history for this robot. Reset Paper Account to $10,000?')
    if (!confirmed) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/robots/${robotId}/reset-paper`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reset')
      alert('Paper account reset successfully')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button 
        onClick={handleReset} 
        disabled={disabled || loading}
        className="flex items-center px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <RotateCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        Reset Paper Account
      </button>
      {disabled && <p className="text-xs text-slate-500">Stop robot to enable reset</p>}
      {error && <p className="text-xs text-red-500 flex items-center"><AlertCircle className="w-3 h-3 mr-1"/>{error}</p>}
    </div>
  )
}
