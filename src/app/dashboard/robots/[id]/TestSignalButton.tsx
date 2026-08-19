'use client'

import { useState } from 'react'
import { Webhook, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface TestSignalResult {
  testId?: string
  worker_request_status?: string
  worker_response_status?: number
  worker_response_text?: string
  duration_ms?: number
  supabase_persistence?: string
  execution_status?: string
  error?: string
}

export default function TestSignalButton({ robotId, status, tradingMode }: { robotId: string, status: string, tradingMode: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestSignalResult | null>(null)
  
  // Chỉ hiển thị/cho phép bấm khi robot.status = RUNNING và trading mode = PAPER
  const isAllowed = status === 'RUNNING' && tradingMode === 'PAPER'
  
  if (!isAllowed) return null;

  const handleTest = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const res = await fetch(`/api/robots/${robotId}/test-signal`, {
        method: 'POST'
      })
      
      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setResult({
        error: err.message || 'Network error calling BFF'
      })
    } finally {
      setLoading(false)
    }
  }

  const renderStatus = (status?: string | number, expected?: string | number) => {
    if (!status && status !== 0) return <span className="text-slate-400">PENDING</span>
    
    // Nếu status là số (HTTP code)
    if (typeof status === 'number') {
      if (status >= 200 && status < 300) return <span className="text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> {status}</span>
      return <span className="text-red-600 flex items-center gap-1"><XCircle className="w-3 h-3"/> {status}</span>
    }
    
    // Nếu status là string
    if (status === expected) return <span className="text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> {status}</span>
    if (status === 'SKIPPED') return <span className="text-blue-600 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> SKIPPED</span>
    
    return <span className="text-red-600 flex items-center gap-1"><XCircle className="w-3 h-3"/> {status}</span>
  }

  return (
    <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="font-semibold text-slate-800 flex items-center">
          <Webhook className="w-4 h-4 mr-2" />
          Test Signal Pipeline (E2E)
        </h3>
        
        <button
          onClick={handleTest}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm font-medium shadow-sm"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Webhook className="w-4 h-4 mr-2" />}
          TEST SIGNAL
        </button>
      </div>
      
      {result && (
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
               <div className="text-xs font-semibold text-slate-500 mb-2 uppercase">1. BFF</div>
               <div className="text-sm font-bold">
                 {!result.error ? renderStatus('OK', 'OK') : renderStatus('FAILED')}
               </div>
            </div>
            
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
               <div className="text-xs font-semibold text-slate-500 mb-2 uppercase">2. CF Worker</div>
               <div className="text-sm font-bold">
                 {result.worker_response_status === 404 ? (
                    <span className="text-orange-500 flex items-center gap-1 flex-col"><XCircle className="w-4 h-4"/> BLOCKED (404)</span>
                 ) : (
                    renderStatus(result.worker_response_status, 200)
                 )}
               </div>
            </div>
            
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
               <div className="text-xs font-semibold text-slate-500 mb-2 uppercase">3. Webhook (Vercel)</div>
               <div className="text-sm font-bold">
                  {result.supabase_persistence === 'SUCCESS' ? renderStatus('OK', 'OK') : <span className="text-slate-400">N/A</span>}
               </div>
            </div>
            
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
               <div className="text-xs font-semibold text-slate-500 mb-2 uppercase">4. DB (Supabase)</div>
               <div className="text-sm font-bold">
                 {renderStatus(result.supabase_persistence, 'SUCCESS')}
               </div>
            </div>

            <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100 flex flex-col items-center text-center">
               <div className="text-xs font-semibold text-indigo-500 mb-2 uppercase">5. Execution</div>
               <div className="text-sm font-bold">
                 {renderStatus(result.execution_status, 'SKIPPED')}
               </div>
            </div>
            
          </div>
          
          <div className="mt-6 bg-slate-900 rounded-lg p-4 font-mono text-xs text-green-400 overflow-x-auto">
             <div className="flex justify-between text-slate-500 mb-2 border-b border-slate-800 pb-2">
                <span>TEST_ID: {result.testId || 'N/A'}</span>
                <span>LATENCY: {result.duration_ms ? `${result.duration_ms}ms` : 'N/A'}</span>
             </div>
             {result.error && <div className="text-red-400 mb-1">Error: {result.error}</div>}
             {result.worker_response_text && (
               <div className="whitespace-pre-wrap">CF_RESPONSE: {result.worker_response_text}</div>
             )}
          </div>
        </div>
      )}
    </div>
  )
}
