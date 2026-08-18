'use client'

import { useState } from 'react'
import { Play, Square, Archive, Check, Zap, Pause } from 'lucide-react'
import { sendRobotCommand, archiveRobotAction, applyRobotConfigAction, toggleTradingAction } from './actions'

type ActionType = 'CONTROLS' | 'APPLY_CONFIG'

export default function RobotControlPanel({ 
  robotId, 
  currentStatus, 
  tradingEnabled,
  configId, 
  action 
}: { 
  robotId: string, 
  currentStatus?: string, 
  tradingEnabled?: boolean,
  configId?: string, 
  action: ActionType 
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCommand = async (cmd: 'START' | 'STOP') => {
    setLoading(true)
    setError('')
    const result = await sendRobotCommand(robotId, cmd)
    if (result.error) setError(result.error)
    setLoading(false)
  }

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this robot? This cannot be undone.')) return
    setLoading(true)
    setError('')
    const result = await archiveRobotAction(robotId)
    if (result.error) setError(result.error)
    setLoading(false)
  }

  const handleToggleTrading = async (enabled: boolean) => {
    setLoading(true)
    setError('')
    const result = await toggleTradingAction(robotId, enabled)
    if (result.error) setError(result.error)
    setLoading(false)
  }

  const handleApplyConfig = async () => {
    if (!configId) return
    setLoading(true)
    setError('')
    const result = await applyRobotConfigAction(robotId, configId)
    if (result.error) setError(result.error)
    setLoading(false)
  }

  if (action === 'APPLY_CONFIG') {
    return (
      <div className="flex flex-col items-end gap-1">
        <button 
          onClick={handleApplyConfig}
          disabled={loading}
          className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium flex items-center border border-blue-100 disabled:opacity-50"
        >
          <Check className="w-4 h-4 mr-1" />
          {loading ? 'Applying...' : 'Apply Version'}
        </button>
        {error && <span className="text-[10px] text-red-500">{error}</span>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => handleCommand('START')}
          disabled={loading || currentStatus === 'RUNNING' || currentStatus === 'ARCHIVED'}
          className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-green-300 hover:text-green-600 transition-colors disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-inherit"
        >
          <Play className="w-5 h-5 mb-1" />
          <span className="text-sm font-medium">Start Lifecycle</span>
        </button>
        
        <button
          onClick={() => handleCommand('STOP')}
          disabled={loading || currentStatus === 'STOPPED' || currentStatus === 'ARCHIVED' || currentStatus === 'CREATED'}
          className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-orange-300 hover:text-orange-600 transition-colors disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-inherit"
        >
          <Square className="w-5 h-5 mb-1" />
          <span className="text-sm font-medium">Stop Lifecycle</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <button
          onClick={() => handleToggleTrading(true)}
          disabled={loading || tradingEnabled || currentStatus === 'ARCHIVED'}
          className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-emerald-300 hover:text-emerald-600 transition-colors disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-inherit"
        >
          <Zap className="w-5 h-5 mb-1" />
          <span className="text-sm font-medium text-center">Activate Trading</span>
        </button>
        
        <button
          onClick={() => handleToggleTrading(false)}
          disabled={loading || !tradingEnabled || currentStatus === 'ARCHIVED'}
          className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 hover:text-slate-600 transition-colors disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-inherit"
        >
          <Pause className="w-5 h-5 mb-1" />
          <span className="text-sm font-medium text-center">Pause Trading</span>
        </button>
      </div>

      <button
        onClick={handleArchive}
        disabled={loading || currentStatus === 'ARCHIVED'}
        className="w-full flex items-center justify-center p-3 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 font-medium"
      >
        <Archive className="w-4 h-4 mr-2" />
        Archive Robot
      </button>
    </div>
  )
}
