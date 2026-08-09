'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, ShieldAlert, Zap, Server, Activity } from 'lucide-react';
import Link from 'next/link';

export default function CreateRobotPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    timeframe: '1m',
    signal_source: 'TradingView',
    execution_symbol: 'XAUUSD',
    provider: 'Binance',
    
    // TradingView config
    tvLength: 20,
    tvSource: 'close',
    tvMult: 2.5,
    tvMult2: 1.3
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Auto-generate slug if name changes and slug hasn't been manually touched (simplified)
    if (name === 'name' && !formData.slug) {
       setFormData(prev => ({
         ...prev,
         slug: value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 50)
       }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        name: formData.name,
        slug: formData.slug,
        timeframe: formData.timeframe,
        signal_source: formData.signal_source,
        trading_view_symbol: formData.execution_symbol,
        execution_symbol: formData.execution_symbol,
        provider: formData.provider,
        indicator_profile: {
          name: 'BB_MB',
          length: Number(formData.tvLength),
          source: formData.tvSource,
          mult: Number(formData.tvMult),
          mult2: Number(formData.tvMult2)
          // Mapping is injected by API schema
        }
      };

      const res = await fetch('/api/robots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create robot');
      }

      router.push('/robots');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/robots" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft size={20} className="text-slate-500" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Create New Robot</h2>
          <p className="text-sm text-slate-500 mt-1">Configure a new digital trading employee.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
          <ShieldAlert size={20} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Basic Info */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
            <Zap size={20} className="text-blue-500" />
            <h3 className="font-semibold text-slate-800 text-lg">Basic Information</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Robot Name</label>
              <input 
                required
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="e.g. Gold Scalper Alpha"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Webhook Slug (Unique ID)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-sm pointer-events-none">/tv/</span>
                <input 
                  required
                  type="text" 
                  name="slug"
                  value={formData.slug}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                  placeholder="RobotXAU"
                />
              </div>
              <p className="text-xs text-slate-500">This slug will be used in your TradingView webhook URL.</p>
            </div>
          </div>
        </div>

        {/* Integration */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
            <Server size={20} className="text-indigo-500" />
            <h3 className="font-semibold text-slate-800 text-lg">Integrations & Symbol</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Signal Source</label>
              <select 
                name="signal_source"
                value={formData.signal_source}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
              >
                <option value="TradingView">TradingView</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Execution Provider</label>
              <select 
                name="provider"
                value={formData.provider}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
              >
                <option value="Binance">Binance</option>
                <option value="Exness">Exness</option>
                <option value="OKX">OKX</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Execution Symbol</label>
              <input 
                required
                type="text" 
                name="execution_symbol"
                value={formData.execution_symbol}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono uppercase"
                placeholder="XAUUSD"
              />
            </div>
          </div>
        </div>

        {/* TradingView Configuration */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
            <Activity size={20} className="text-emerald-500" />
            <h3 className="font-semibold text-slate-800 text-lg">TradingView Configuration (BB+MB)</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Timeframe</label>
              <input type="text" name="timeframe" value={formData.timeframe} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Length</label>
              <input type="number" name="tvLength" value={formData.tvLength} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Source</label>
              <input type="text" name="tvSource" value={formData.tvSource} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Mult</label>
              <input type="number" step="0.1" name="tvMult" value={formData.tvMult} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Mult2</label>
              <input type="number" step="0.1" name="tvMult2" value={formData.tvMult2} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
            </div>
          </div>

          <div className="mt-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Canonical Line Mapping (Read-Only)</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {['upper', 'upper2', 'basis', 'lower2', 'lower'].map((mapVal, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-xs text-slate-500 mb-1">Plot {i+1}</span>
                  <div className="bg-slate-200 px-3 py-2 rounded-md text-sm font-mono text-slate-600 text-center cursor-not-allowed border border-slate-300">
                    {mapVal}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3 flex gap-2">
              <ShieldAlert size={14} />
              Mapping is strictly immutable and enforced by Data Contract V1 to ensure determinism.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button 
            type="submit" 
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 bg-blue-600 text-white hover:bg-blue-700 h-10 px-8 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Creating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save size={16} />
                Create Robot
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
