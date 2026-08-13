'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { calculateRiskPreview } from '@/core/engine/risk/RiskCalculator';
import { getOrCreateSimulatorRobot, openSimulatorTrade, sendSimulatedCandle, resetSimulator, playCandleSequence, closeSimulatorTrade } from '@/app/actions/simulatorActions';
import { createClient } from '@/lib/supabase/client';

export default function SimulatorPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'QUICK' | 'MARKET_DATA'>('QUICK');
  const [userId, setUserId] = useState<string | null>(null);
  const [robot, setRobot] = useState<any>(null);
  const [position, setPosition] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [tradingViewSymbol, setTradingViewSymbol] = useState('BINANCE:BTCUSDT');
  const [timeframe, setTimeframe] = useState('15m');
  const [balance, setBalance] = useState(10000);
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  
  const [sizingMode, setSizingMode] = useState<'RISK' | 'ALLOCATION'>('RISK');
  const [riskPercent, setRiskPercent] = useState(1);
  const [allocationPercent, setAllocationPercent] = useState(10);
  const [startingBalanceInput, setStartingBalanceInput] = useState(10000);
  
  const [entryPrice, setEntryPrice] = useState(100000);
  const [takeProfit, setTakeProfit] = useState(102000);
  const [stopLoss, setStopLoss] = useState(99000);
  
  const [manualCurrentPrice, setManualCurrentPrice] = useState(101000);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [candlesText, setCandlesText] = useState("100, 100, 80, 85\n85, 100, 85, 95\n95, 95, 79, 80\n81, 110, 81, 105");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        fetchRobot(data.user.id, 10000);
      }
    });
  }, []);

  const fetchRobot = async (uid: string, initialBal: number) => {
    try {
      const r = await getOrCreateSimulatorRobot(uid, initialBal);
      setRobot(r);
      setBalance(r.paper_balance);
      setStartingBalanceInput(r.paper_balance);
      fetchPosition(r.id);
      fetchTrades(r.id);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const fetchPosition = async (rid: string) => {
    const { data } = await supabase.from('active_positions').select('*').eq('robot_id', rid).single();
    setPosition(data || null);
    if (data) setManualCurrentPrice(data.entry_price);
  };

  const fetchTrades = async (rid: string) => {
    const { data } = await supabase.from('trade_history').select('*').eq('robot_id', rid).order('created_at', { ascending: false });
    setTrades(data || []);
  };

  const handleOpenTrade = async () => {
    if (!robot || !userId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await openSimulatorTrade({
        userId, robotId: robot.id, symbol, tradingViewSymbol, direction, entryPrice, stopLoss, takeProfit, balance, sizingMode, riskPercent, allocationPercent
      });
      await fetchPosition(robot.id);
      await fetchTrades(robot.id);
      
      // Update local balance
      const { data: updatedRobot } = await supabase.from('robots').select('paper_balance').eq('id', robot.id).single();
      if (updatedRobot) setBalance(updatedRobot.paper_balance);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendCandle = async (high: number, low: number, close: number = manualCurrentPrice) => {
    if (!robot) return;
    setIsSubmitting(true);
    try {
      await sendSimulatedCandle({
        robotId: robot.id, symbol, timeframe, open: manualCurrentPrice, high, low, close
      });
      await fetchPosition(robot.id);
      await fetchTrades(robot.id);
      
      const { data: updatedRobot } = await supabase.from('robots').select('paper_balance').eq('id', robot.id).single();
      if (updatedRobot) {
        setRobot((prev: any) => ({ ...prev, paper_balance: updatedRobot.paper_balance }));
        setBalance(updatedRobot.paper_balance);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseTrade = async () => {
    if (!robot || !userId || !position) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await closeSimulatorTrade(robot.id, manualCurrentPrice);
      await fetchPosition(robot.id);
      await fetchTrades(robot.id);
      
      const { data: updatedRobot } = await supabase.from('robots').select('paper_balance').eq('id', robot.id).single();
      if (updatedRobot) {
        setRobot((prev: any) => ({ ...prev, paper_balance: updatedRobot.paper_balance }));
        setBalance(updatedRobot.paper_balance);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!userId || !confirm('Reset Simulator?')) return;
    await resetSimulator(userId, startingBalanceInput);
    await fetchRobot(userId, startingBalanceInput);
  };

  const handlePlaySequence = async () => {
    if (!robot || !userId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const parsed = candlesText.split('\n').filter(l => l.trim()).map(line => {
        const [o, h, l, c] = line.split(',').map(Number);
        if (isNaN(o) || isNaN(h) || isNaN(l) || isNaN(c)) throw new Error('Invalid candle format. Must be "O, H, L, C"');
        return { open: o, high: h, low: l, close: c };
      });
      await playCandleSequence({
        robotId: robot.id,
        symbol,
        timeframe,
        candles: parsed,
        balance,
        riskPercent,
        maxAllocationPercent: allocationPercent,
        leverage: 1
      });
      await fetchPosition(robot.id);
      await fetchTrades(robot.id);
      
      const { data: updatedRobot } = await supabase.from('robots').select('paper_balance').eq('id', robot.id).single();
      if (updatedRobot) {
        setRobot((prev: any) => ({ ...prev, paper_balance: updatedRobot.paper_balance }));
        setBalance(updatedRobot.paper_balance);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const preview = useMemo(() => {
    try {
      const riskResult = calculateRiskPreview({
        accountBalance: balance,
        direction,
        entryReferencePrice: entryPrice,
        stopLoss,
        takeProfit,
        riskPercent: sizingMode === 'RISK' ? (riskPercent / 100) : 0.01,
        maxAllocationPercent: sizingMode === 'ALLOCATION' ? (allocationPercent / 100) : 1,
        leverage: 1
      });

      let q = 0;
      if (sizingMode === 'ALLOCATION') q = (balance * (allocationPercent / 100)) / entryPrice;
      else q = riskResult.positionSize;

      return {
        quantity: q,
        value: q * entryPrice,
        riskAmount: sizingMode === 'RISK' ? riskResult.riskAmount : Math.abs(entryPrice - stopLoss) * q,
        profitAmount: Math.abs(takeProfit - entryPrice) * q,
        rr: riskResult.riskRewardRatio,
        error: null
      };
    } catch (e: any) {
      return { error: e.message };
    }
  }, [balance, direction, entryPrice, stopLoss, takeProfit, sizingMode, riskPercent, allocationPercent]);

  const unrealizedPnl = position ? 
    (position.side === 'LONG' ? (manualCurrentPrice - position.entry_price) * position.quantity : (position.entry_price - manualCurrentPrice) * position.quantity) 
    : 0;

  const returnPercent = position ? (unrealizedPnl / (position.entry_price * position.quantity) * 100).toFixed(2) : '0.00';
  const distTP = position ? ((position.side === 'LONG' ? (position.take_profit_price / manualCurrentPrice) - 1 : 1 - (position.take_profit_price / manualCurrentPrice)) * 100).toFixed(2) : '0.00';
  const distSL = position ? ((position.side === 'LONG' ? (position.stop_loss_price / manualCurrentPrice) - 1 : 1 - (position.stop_loss_price / manualCurrentPrice)) * 100).toFixed(2) : '0.00';

  const totalTrades = trades.length;
  const wins = trades.filter(t => t.pnl > 0).length;
  const losses = trades.filter(t => t.pnl < 0).length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalWithUnrealized = totalPnl + unrealizedPnl;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">PAPER TRADING SIMULATOR</h1>
        <button onClick={handleReset} className="px-4 py-2 bg-red-100 text-red-600 rounded font-semibold text-sm">RESET SIMULATOR</button>
      </div>

      <div className="bg-slate-800 text-white p-6 rounded-xl flex flex-col md:flex-row justify-between items-center shadow-lg gap-4">
        <div>
          <div className="text-blue-300 text-sm font-bold tracking-widest">PAPER TRADING</div>
          <div className="text-2xl font-bold mt-1">{robot?.name || 'Loading...'}</div>
          <div className="text-sm text-slate-400 mt-1">{symbol} &bull; {timeframe} &bull; PAPER</div>
        </div>
        <div className="flex gap-4 md:gap-8 text-right">
          <div className="hidden md:block">
            <div className="text-slate-400 text-xs uppercase tracking-wider">Starting Balance</div>
            <div className="font-mono text-lg">${startingBalanceInput.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-slate-400 text-xs uppercase tracking-wider">Current Balance</div>
            <div className="font-mono text-xl font-bold text-blue-400">${balance.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-slate-400 text-xs uppercase tracking-wider">Realized P&L</div>
            <div className={`font-mono text-lg font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-xs uppercase tracking-wider">Unrealized P&L</div>
            <div className={`font-mono text-lg font-bold ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button 
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'QUICK' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          onClick={() => setActiveTab('QUICK')}
        >
          QUICK SIMULATOR
        </button>
        <button 
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'MARKET_DATA' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          onClick={() => setActiveTab('MARKET_DATA')}
        >
          MARKET DATA SIMULATOR
        </button>
      </div>

      {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      {activeTab === 'QUICK' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: SETUP */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-semibold text-lg border-b pb-2">1. Quick Setup</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Symbol</label>
              <input type="text" value={symbol} onChange={e => { setSymbol(e.target.value); setTradingViewSymbol(`BINANCE:${e.target.value}`); }} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Timeframe</label>
              <select value={timeframe} onChange={e => setTimeframe(e.target.value)} className="w-full border p-2 rounded">
                {['1m','5m','15m','1h','4h','1d'].map(tf => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Starting Balance</label>
            <input type="number" value={startingBalanceInput} onChange={e => setStartingBalanceInput(Number(e.target.value))} className="w-full border p-2 rounded" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Direction</label>
            <div className="flex gap-2">
              <button onClick={() => setDirection('LONG')} className={`flex-1 py-2 rounded font-bold ${direction==='LONG'?'bg-green-500 text-white':'bg-slate-100'}`}>LONG</button>
              <button onClick={() => setDirection('SHORT')} className={`flex-1 py-2 rounded font-bold ${direction==='SHORT'?'bg-red-500 text-white':'bg-slate-100'}`}>SHORT</button>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <label className="block text-xs font-semibold text-slate-500">Position Sizing</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1"><input type="radio" checked={sizingMode==='RISK'} onChange={()=>setSizingMode('RISK')}/> Risk %</label>
              <label className="flex items-center gap-1"><input type="radio" checked={sizingMode==='ALLOCATION'} onChange={()=>setSizingMode('ALLOCATION')}/> % Balance</label>
            </div>
            {sizingMode === 'ALLOCATION' && <input type="number" value={allocationPercent} onChange={e=>setAllocationPercent(Number(e.target.value))} className="w-full border p-2 rounded" placeholder="Allocation %" />}
            {sizingMode === 'RISK' && <input type="number" value={riskPercent} onChange={e=>setRiskPercent(Number(e.target.value))} className="w-full border p-2 rounded" placeholder="Risk %" />}
          </div>

          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Entry Price</label>
              <input type="number" value={entryPrice} onChange={e => setEntryPrice(Number(e.target.value))} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Take Profit</label>
              <input type="number" value={takeProfit} onChange={e => setTakeProfit(Number(e.target.value))} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Stop Loss</label>
              <input type="number" value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))} className="w-full border p-2 rounded" />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded text-sm mt-4">
            <h3 className="font-semibold mb-2">Live Preview</h3>
            {preview.error ? (
               <p className="text-red-500">{preview.error}</p>
            ) : (
               <div className="grid grid-cols-2 gap-2">
                 <div>Quantity: <span className="font-semibold">{preview.quantity?.toFixed(4)}</span></div>
                 <div>Value: <span className="font-semibold">${preview.value?.toFixed(2)}</span></div>
                 <div>Risk Amt: <span className="font-semibold text-red-500">${preview.riskAmount?.toFixed(2)}</span></div>
                 <div>Reward Amt: <span className="font-semibold text-green-500">${preview.profitAmount?.toFixed(2)}</span></div>
               </div>
            )}
          </div>

          <button 
            disabled={isSubmitting || !!position || !!preview.error} 
            onClick={handleOpenTrade}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg disabled:opacity-50"
          >
            {position ? 'POSITION ALREADY OPEN' : 'OPEN PAPER TRADE'}
          </button>
        </div>

        {/* RIGHT COLUMN: POSITION & CANDLE SIM */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="font-semibold text-lg border-b pb-2 mb-4">2. Live Paper Position</h2>
            {!position ? (
              <p className="text-slate-500 text-sm">No active position.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded border">
                  <div>
                    <span className="text-xs text-slate-500">PAPER POSITION</span>
                    <div className="font-bold text-lg">
                      {position.side === 'LONG' ? '🟢 LONG ' : '🔴 SHORT '} 
                      {position.symbol} &bull; {timeframe}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Unrealized P&L</span>
                    <div className={`font-bold text-xl ${unrealizedPnl >= 0 ? 'text-green-600':'text-red-600'}`}>
                      {unrealizedPnl >= 0 ? '+':''}{unrealizedPnl.toFixed(2)}
                      <span className="text-sm block text-slate-500 font-normal mt-1">{returnPercent}% Return</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="block text-xs text-slate-500">Entry</span><span className="font-semibold">{position.entry_price}</span></div>
                  <div><span className="block text-xs text-slate-500">TP</span><span className="font-semibold text-green-600">{position.take_profit_price}</span></div>
                  <div><span className="block text-xs text-slate-500">SL</span><span className="font-semibold text-red-600">{position.stop_loss_price}</span></div>
                  <div><span className="block text-xs text-slate-500">Qty</span><span className="font-semibold">{position.quantity}</span></div>
                  <div><span className="block text-xs text-slate-500">Value</span><span className="font-semibold">${(position.quantity * position.entry_price).toFixed(2)}</span></div>
                </div>

                <div className="border-t pt-4">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Manual Current Price (UI Only)</label>
                  <div className="flex gap-2">
                    <input type="number" value={manualCurrentPrice} onChange={e => setManualCurrentPrice(Number(e.target.value))} className="flex-1 border p-2 rounded" />
                    <button onClick={handleCloseTrade} disabled={isSubmitting} className="px-6 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700 disabled:opacity-50">CLOSE AT CURRENT PRICE</button>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs">
                    <div>Dist to TP: <span className="font-bold">{distTP}%</span></div>
                    <div>Dist to SL: <span className="font-bold">{distSL}%</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {position && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h2 className="font-semibold text-lg border-b pb-2 mb-4">5 BB LINES</h2>
                <div className="text-sm bg-yellow-50 text-yellow-800 p-4 rounded border border-yellow-200 space-y-2">
                  <p className="font-bold">Not available in Quick Simulator</p>
                  <p>QUICK SIMULATOR does not generate real BB_MB indicator values.</p>
                  <p className="text-xs text-yellow-600 mt-2">Use MARKET DATA SIMULATOR to see real indicator lines.</p>
                </div>
              </div>
              
              <div>
                <h2 className="font-semibold text-lg border-b pb-2 mb-4">ENTRY AUDIT</h2>
                <div className="text-sm bg-slate-50 p-4 rounded border text-slate-500">
                  <p>N/A &mdash; Quick Simulation</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="font-semibold text-lg border-b pb-2 mb-4">3. Candle Simulator</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button disabled={!position || isSubmitting} onClick={() => handleSendCandle(position.take_profit_price, position.take_profit_price)} className="p-2 bg-green-100 text-green-700 rounded font-bold disabled:opacity-50">HIT TP</button>
              <button disabled={!position || isSubmitting} onClick={() => handleSendCandle(position.stop_loss_price, position.stop_loss_price)} className="p-2 bg-red-100 text-red-700 rounded font-bold disabled:opacity-50">HIT SL</button>
            </div>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'MARKET_DATA' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="font-semibold text-lg border-b pb-2">1. Sequence Setup</h2>
            <p className="text-xs text-slate-500">Provide a sequence of candles (Open, High, Low, Close). The engine will automatically generate 20 warmup candles prior to this sequence to initialize the BB_MB indicator.</p>
            <textarea 
              className="w-full h-64 border p-3 rounded text-sm font-mono"
              value={candlesText}
              onChange={e => setCandlesText(e.target.value)}
              placeholder={"100, 100, 80, 85\n85, 100, 85, 95"}
            />
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Starting Balance</label>
                <input type="number" value={balance} onChange={e => setBalance(Number(e.target.value))} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Risk %</label>
                <input type="number" value={riskPercent} onChange={e => setRiskPercent(Number(e.target.value))} className="w-full border p-2 rounded" />
              </div>
            </div>

            <button 
              disabled={isSubmitting} 
              onClick={handlePlaySequence}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg disabled:opacity-50 mt-4"
            >
              {isSubmitting ? 'PLAYING SEQUENCE...' : '▶ PLAY CANDLES'}
            </button>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="font-semibold text-lg border-b pb-2 mb-4">2. Execution State</h2>
            {!position ? (
              <p className="text-slate-500 text-sm">No active position at the end of the sequence.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded border">
                  <div>
                    <span className="text-xs text-slate-500">PAPER TRADING</span>
                    <div className="font-bold text-lg">{position.symbol} <span className={`text-xs px-2 py-1 rounded ${position.side==='LONG'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{position.side}</span></div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Quantity</span>
                    <div className="font-bold text-xl">{position.quantity}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="block text-xs text-slate-500">Entry</span><span className="font-semibold">{position.entry_price}</span></div>
                  <div><span className="block text-xs text-slate-500">TP</span><span className="font-semibold text-green-600">{position.take_profit_price}</span></div>
                  <div><span className="block text-xs text-slate-500">SL</span><span className="font-semibold text-red-600">{position.stop_loss_price}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-6">
        <div className="flex justify-between items-end border-b pb-2 mb-4">
          <h2 className="font-semibold text-lg">Trade History</h2>
          <div className="flex gap-4 text-sm text-slate-600">
            <div>Total Trades: <span className="font-bold">{totalTrades}</span></div>
            <div>Wins: <span className="font-bold text-green-600">{wins}</span></div>
            <div>Losses: <span className="font-bold text-red-600">{losses}</span></div>
            <div>Win Rate: <span className="font-bold">{winRate}%</span></div>
            <div>Realized P&L: <span className={`font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}</span></div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-2">Time</th>
                <th className="p-2">Symbol</th>
                <th className="p-2">Side</th>
                <th className="p-2">Entry</th>
                <th className="p-2">Exit</th>
                <th className="p-2">P&L</th>
                <th className="p-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {trades.map(t => (
                <tr key={t.id} className="border-b">
                  <td className="p-2">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="p-2 font-semibold">{t.symbol}</td>
                  <td className="p-2">{t.action}</td>
                  <td className="p-2">{t.entry_price}</td>
                  <td className="p-2">{t.exit_price}</td>
                  <td className={`p-2 font-bold ${t.pnl >= 0 ? 'text-green-600':'text-red-600'}`}>{t.pnl >= 0 ? '+':''}{t.pnl}</td>
                  <td className="p-2">{t.reason}</td>
                </tr>
              ))}
              {trades.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-slate-500">No trades yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-6">
        <h2 className="font-semibold text-lg border-b pb-2 mb-4">5-Line Visualization</h2>
        <p className="text-sm text-slate-500">Not available for this manual simulation. (Waiting for backend `trade_snapshots` persistence phase).</p>
      </div>

    </div>
  );
}
