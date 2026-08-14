'use client';

import React, { useState, useEffect } from 'react';
import { getOrCreateSimulatorRobot, resetSimulator, updateSimulatorConfig, sendSimulatedWebhook } from '@/app/actions/simulatorActions';
import { createClient } from '@/lib/supabase/client';

export default function SimulatorPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [robot, setRobot] = useState<any>(null);
  const [position, setPosition] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);

  // Config State
  const [tradingViewSymbol, setTradingViewSymbol] = useState('BINANCE:BTCUSDT');
  const [executionSymbol, setExecutionSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('15');
  const [bbLength, setBbLength] = useState(20);
  const [bbSource, setBbSource] = useState('close');
  const [bbMult, setBbMult] = useState(2.0);
  const [bbMult2, setBbMult2] = useState(1.0);

  // Webhook State (Basic)
  const [simOpen, setSimOpen] = useState(100);
  const [simHigh, setSimHigh] = useState(105);
  const [simLow, setSimLow] = useState(95);
  const [simClose, setSimClose] = useState(100);

  // Webhook State (Advanced)
  const [rawPayload, setRawPayload] = useState('{\n  "tvSymbol": "BINANCE:BTCUSDT",\n  "timeframe": "15",\n  "barTimestamp": 1718000000000,\n  "open": 100,\n  "high": 105,\n  "low": 95,\n  "close": 100,\n  "volume": 1000,\n  "indicator": {\n    "length": 20,\n    "source": "close",\n    "mult": 2.0,\n    "mult2": 1.0\n  },\n  "plots": {\n    "upper": 110,\n    "upper2": 105,\n    "basis": 100,\n    "lower2": 95,\n    "lower": 90\n  }\n}');

  const [activeTab, setActiveTab] = useState<'BASIC' | 'ADVANCED'>('BASIC');
  
  const [balance, setBalance] = useState(10000);
  const [startingBalanceInput, setStartingBalanceInput] = useState(10000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        fetchRobot(data.user.id, 10000);
      }
    });
  }, []);

  // Set up realtime subscription for active position and robot state
  useEffect(() => {
    if (!robot?.id) return;
    
    const channel = supabase.channel(`simulator-${robot.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_positions', filter: `robot_id=eq.${robot.id}` }, () => {
        fetchPosition(robot.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'robots', filter: `id=eq.${robot.id}` }, () => {
        fetchRobot(userId!, startingBalanceInput, true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_history', filter: `robot_id=eq.${robot.id}` }, () => {
        fetchTrades(robot.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [robot?.id]);

  const fetchRobot = async (uid: string, initialBal: number, skipConfigOverride = false) => {
    try {
      const r = await getOrCreateSimulatorRobot(uid, initialBal);
      setRobot(r);
      setBalance(r.paper_balance);
      
      if (!skipConfigOverride) {
        setStartingBalanceInput(r.paper_balance);
        setTradingViewSymbol(r.trading_view_symbol);
        setExecutionSymbol(r.execution_symbol);
        setTimeframe(r.timeframe);

        // Fetch config
        const { data: c } = await supabase.from('robot_configs').select('*').eq('robot_id', r.id).eq('status', 'ACTIVE').single();
        if (c && c.indicator_profile) {
          setBbLength(c.indicator_profile.length || 20);
          setBbSource(c.indicator_profile.source || 'close');
          setBbMult(c.indicator_profile.mult || 2.0);
          setBbMult2(c.indicator_profile.mult2 || 1.0);
        }
      }
      
      fetchPosition(r.id);
      fetchTrades(r.id);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const fetchPosition = async (rid: string) => {
    const { data } = await supabase.from('active_positions').select('*').eq('robot_id', rid).single();
    setPosition(data || null);
  };

  const fetchTrades = async (rid: string) => {
    const { data } = await supabase.from('trade_history').select('*').eq('robot_id', rid).order('created_at', { ascending: false });
    setTrades(data || []);
  };

  const handleSaveConfig = async () => {
    if (!robot) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await updateSimulatorConfig({
        robotId: robot.id,
        tradingViewSymbol,
        executionSymbol,
        timeframe,
        bbLength,
        bbSource,
        bbMult,
        bbMult2
      });
      setSuccessMsg('Configuration updated. Core Engine will now use these settings.');
      await fetchRobot(userId!, startingBalanceInput);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendBasicWebhook = async () => {
    if (!robot) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // In basic mode, we auto-generate standard plots so the UI user doesn't have to input them.
      // This is purely for webhook simulation testing without manual calculations.
      const payload = {
        tvSymbol: tradingViewSymbol,
        tvTickerId: executionSymbol,
        timeframe: timeframe,
        barTimestamp: Date.now(),
        open: simOpen,
        high: simHigh,
        low: simLow,
        close: simClose,
        volume: 100,
        indicator: { length: bbLength, source: bbSource, mult: bbMult, mult2: bbMult2 },
        plots: { 
          upper: simClose + 10, 
          upper2: simClose + 5, 
          basis: simClose, 
          lower2: simClose - 5, 
          lower: simClose - 10 
        }
      };
      const res = await sendSimulatedWebhook({ robotId: robot.id, payload });
      setSuccessMsg(`Webhook sent successfully. Command ID: ${res.command_id || 'OK'}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendAdvancedWebhook = async () => {
    if (!robot) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const payload = JSON.parse(rawPayload);
      const res = await sendSimulatedWebhook({ robotId: robot.id, payload });
      setSuccessMsg(`Webhook sent successfully. Command ID: ${res.command_id || 'OK'}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!userId || !confirm('Reset Simulator? This will wipe all trade history and reset balance.')) return;
    await resetSimulator(userId, startingBalanceInput);
    await fetchRobot(userId, startingBalanceInput);
    setSuccessMsg('Simulator reset.');
  };

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  // Unrealized P&L can only be calculated if we track current price. For webhook simulator, we just use the last simulated close.
  const unrealizedPnl = position ? 
    (position.side === 'LONG' ? (simClose - position.entry_price) * position.quantity : (position.entry_price - simClose) * position.quantity) 
    : 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">WEBHOOK SIMULATOR</h1>
        <button onClick={handleReset} className="px-4 py-2 bg-red-100 text-red-600 rounded font-semibold text-sm hover:bg-red-200">RESET SIMULATOR</button>
      </div>

      <div className="bg-slate-800 text-white p-6 rounded-xl flex flex-col md:flex-row justify-between items-center shadow-lg gap-4">
        <div>
          <div className="text-blue-300 text-sm font-bold tracking-widest">PAPER TRADING</div>
          <div className="text-2xl font-bold mt-1">{robot?.name || 'Loading...'}</div>
          <div className="text-sm text-slate-400 mt-1">State: <span className="text-emerald-400 font-bold">{robot?.current_state || 'UNKNOWN'}</span></div>
        </div>
        <div className="flex gap-4 md:gap-8 text-right">
          <div>
            <div className="text-slate-400 text-xs uppercase tracking-wider">Paper Balance</div>
            <div className="font-mono text-xl font-bold text-blue-400">${balance.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-slate-400 text-xs uppercase tracking-wider">Realized P&L</div>
            <div className={`font-mono text-lg font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded shadow-sm">{error}</div>}
      {successMsg && <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 rounded shadow-sm">{successMsg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: ROBOT CONFIGURATION */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b pb-4">
            <h2 className="font-bold text-lg text-slate-800">Robot Configuration</h2>
            <p className="text-xs text-slate-500 mt-1">Update parameters below. Core Engine is strictly bound to these values.</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">TradingView Symbol</label>
              <input type="text" value={tradingViewSymbol} onChange={e => setTradingViewSymbol(e.target.value)} className="w-full border p-2 rounded text-sm bg-slate-50 focus:bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Execution Symbol</label>
              <input type="text" value={executionSymbol} onChange={e => setExecutionSymbol(e.target.value)} className="w-full border p-2 rounded text-sm bg-slate-50 focus:bg-white" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Timeframe</label>
              <select value={timeframe} onChange={e => setTimeframe(e.target.value)} className="w-full border p-2 rounded text-sm bg-slate-50 focus:bg-white">
                <option value="15">15M</option>
                <option value="30">30M</option>
                <option value="60">1H</option>
                <option value="180">3H</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">BB Source</label>
              <select value={bbSource} onChange={e => setBbSource(e.target.value)} className="w-full border p-2 rounded text-sm bg-slate-50 focus:bg-white">
                <option value="close">Close</option>
                <option value="hlc3">HLC3</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">BB Length</label>
              <input type="number" value={bbLength} onChange={e => setBbLength(Number(e.target.value))} className="w-full border p-2 rounded text-sm bg-slate-50 focus:bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Mult</label>
              <input type="number" step="0.1" value={bbMult} onChange={e => setBbMult(Number(e.target.value))} className="w-full border p-2 rounded text-sm bg-slate-50 focus:bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Mult 2</label>
              <input type="number" step="0.1" value={bbMult2} onChange={e => setBbMult2(Number(e.target.value))} className="w-full border p-2 rounded text-sm bg-slate-50 focus:bg-white" />
            </div>
          </div>
          
          <button 
            disabled={isSubmitting}
            onClick={handleSaveConfig}
            className="w-full py-2 bg-slate-800 text-white rounded font-semibold hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            Save Configuration
          </button>
        </div>

        {/* RIGHT COLUMN: WEBHOOK SIMULATOR */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 flex flex-col">
          <div className="border-b pb-4 flex justify-between items-end">
            <div>
              <h2 className="font-bold text-lg text-slate-800">Simulate Webhook</h2>
              <p className="text-xs text-slate-500 mt-1">Send simulated candles directly to the TV Webhook endpoint.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setActiveTab('BASIC')} className={`text-xs font-semibold px-3 py-1 rounded ${activeTab === 'BASIC' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>Basic</button>
              <button onClick={() => setActiveTab('ADVANCED')} className={`text-xs font-semibold px-3 py-1 rounded ${activeTab === 'ADVANCED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>Raw JSON</button>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col gap-4">
            {activeTab === 'BASIC' ? (
              <div className="space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Open</label>
                    <input type="number" step="any" value={simOpen} onChange={e => setSimOpen(Number(e.target.value))} className="w-full border p-2 rounded font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">High</label>
                    <input type="number" step="any" value={simHigh} onChange={e => setSimHigh(Number(e.target.value))} className="w-full border p-2 rounded font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Low</label>
                    <input type="number" step="any" value={simLow} onChange={e => setSimLow(Number(e.target.value))} className="w-full border p-2 rounded font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Close</label>
                    <input type="number" step="any" value={simClose} onChange={e => setSimClose(Number(e.target.value))} className="w-full border p-2 rounded font-mono" />
                  </div>
                </div>
                <div className="mt-auto pt-4">
                  <button onClick={handleSendBasicWebhook} disabled={isSubmitting} className="w-full py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition-colors shadow shadow-blue-200">
                    Send Basic Webhook
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex-1 flex flex-col">
                <textarea 
                  value={rawPayload}
                  onChange={e => setRawPayload(e.target.value)}
                  className="w-full flex-1 border p-3 rounded font-mono text-xs whitespace-pre bg-slate-900 text-green-400 min-h-[250px]"
                />
                <button onClick={handleSendAdvancedWebhook} disabled={isSubmitting} className="w-full py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition-colors shadow shadow-blue-200 mt-auto">
                  Send Advanced Webhook
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* POSITIONS & TRADES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Active Position</h3>
            {position && (
              <span className={`px-2 py-1 text-xs font-bold rounded ${position.side === 'LONG' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {position.side}
              </span>
            )}
          </div>
          <div className="p-6">
            {!position ? (
              <div className="text-center py-8 text-slate-400">No active positions</div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-4">
                  <div>
                    <div className="text-xl font-bold">{position.symbol}</div>
                    <div className="text-xs text-slate-500 font-mono mt-1">Snapshot: {position.context_snapshot?.tradingViewSymbol} • {position.context_snapshot?.timeframe}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Unrealized P&L</div>
                    <div className={`text-xl font-bold ${unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><div className="text-slate-500 mb-1">Entry Price</div><div className="font-mono font-semibold">${position.entry_price}</div></div>
                  <div><div className="text-slate-500 mb-1">Quantity</div><div className="font-mono font-semibold">{position.quantity}</div></div>
                  <div><div className="text-slate-500 mb-1">Stop Loss</div><div className="font-mono font-semibold text-red-600">${position.stop_loss_price}</div></div>
                  <div><div className="text-slate-500 mb-1">Take Profit</div><div className="font-mono font-semibold text-green-600">${position.take_profit_price}</div></div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-800">Trade History</h3>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {trades.length === 0 ? (
              <div className="text-center py-12 text-slate-400">No trades yet</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-white sticky top-0 border-b">
                  <tr>
                    <th className="px-6 py-3">Symbol</th>
                    <th className="px-6 py-3">Side</th>
                    <th className="px-6 py-3">P&L</th>
                    <th className="px-6 py-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trades.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium">
                        {t.execution_symbol}
                        <div className="text-xs text-slate-400 font-normal">BB {t.indicator_snapshot?.config?.length}</div>
                      </td>
                      <td className={`px-6 py-3 font-bold ${t.side === 'LONG' ? 'text-green-600' : 'text-red-600'}`}>{t.side}</td>
                      <td className={`px-6 py-3 font-bold ${t.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-slate-500 text-right whitespace-nowrap">
                        {new Date(t.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
