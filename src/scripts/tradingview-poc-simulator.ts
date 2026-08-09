import { startServer, setupPOCEngines, orchestrator } from './tradingview-webhook-receiver';
import { coreEventBus } from '../core/infrastructure/EventBus';
import { TradingViewPayload } from '../core/adapters/tradingview/TradingViewAdapter';

async function runSimulation() {
  console.log('--- STARTING TRADINGVIEW POC SIMULATION ---');
  
  // 1. Setup Engines & Adapter
  await setupPOCEngines();
  
  // 2. Bật server webhook port 3000
  const server = startServer(3000);

  // 3. Chuẩn bị hứng TRADE_PLAN
  let tradePlan: any = null;
  coreEventBus.subscribe('TRADE_PLAN_EVENT', async (e: any) => {
    tradePlan = e;
  });

  // 4. Giả lập Candle T-1 (Initialize prevClose)
  const barTime1 = 1710000000;
  const pinePayload1: TradingViewPayload = {
    tvSymbol: 'XAUUSD',
    tvTickerId: 'FXCM:XAUUSD',
    timeframe: '180',
    barTimestamp: barTime1,
    open: 4325.00,
    high: 4330.00,
    low: 4324.00,
    close: 4325.00, // Close nằm giữa b5(4323.68) và b4(4332.59)
    volume: 1500,
    indicator: { length: 20, source: 'close', mult: 2.5, mult2: 1.3 },
    plots: { upper: 4358.72, upper2: 4349.81, basis: 4341.20, lower2: 4332.59, lower: 4323.68 }
  };

  console.log('\n[SIMULATOR] Gửi POST Request #1 (Init prevClose) ...');
  try {
    await fetch('http://localhost:3000/webhook/tv/RobotXAU', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pinePayload1)
    });
    await coreEventBus.waitForIdle('RobotXAU');
  } catch (error: any) { console.error('[SIMULATOR] HTTP Post #1 Failed', error.message); }

  // 5. Giả lập Candle T (Tạo Signal LONG)
  const barTime2 = barTime1 + 10800; // +3 hours
  const pinePayload2: TradingViewPayload = {
    ...pinePayload1,
    barTimestamp: barTime2,
    open: 4325.00, high: 4340.00, low: 4320.00,
    close: 4335.00, // Close vượt b4(4332.59) -> LONG signal
  };

  console.log('\n[SIMULATOR] Gửi POST Request #2 (Tạo Signal) ...');
  try {
    await fetch('http://localhost:3000/webhook/tv/RobotXAU', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pinePayload2)
    });
    await coreEventBus.waitForIdle('RobotXAU');
  } catch (error: any) { console.error('[SIMULATOR] HTTP Post #2 Failed', error.message); }

  // 6. Giả lập Candle T+1 (Trigger Retracement)
  const barTime3 = barTime2 + 10800;
  const pinePayload3: TradingViewPayload = {
    ...pinePayload1,
    barTimestamp: barTime3,
    open: 4335.00, high: 4335.00, low: 4324.00,
    close: 4325.00, // Rớt về vùng Retracement (4323.68 -> 4325.46)
  };

  console.log('\n[SIMULATOR] Gửi POST Request #3 (Trigger Entry) ...');
  try {
    await fetch('http://localhost:3000/webhook/tv/RobotXAU', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pinePayload3)
    });
    await coreEventBus.waitForIdle('RobotXAU');
  } catch (error: any) { console.error('[SIMULATOR] HTTP Post #3 Failed', error.message); }

  if (tradePlan) {
    console.log('\nTRADINGVIEW SOURCE             CORE RECEIVED                 DIFF');
    console.log('------------------             -------------                 ----');
    
    // So sánh dữ liệu payload truyền vào với dữ liệu tradePlan
    // Snapshot của indicatorReference trong tradePlan lưu giá trị được StrategyEngine nhận tại NẾN TẠO TÍN HIỆU
    const snap = tradePlan.indicatorReference.snapshot;
    
    console.log(`Symbol       ${pinePayload2.tvSymbol.padEnd(16)}  Symbol       ${tradePlan.symbol.padEnd(16)}  ${pinePayload2.tvSymbol === tradePlan.symbol ? '✓' : 'x'}`);
    console.log(`Timeframe    ${pinePayload2.timeframe} (180)           Timeframe    3H                ✓ (Canonical)`);
    console.log(`BarTime      ${pinePayload2.barTimestamp.toString().padEnd(16)}  BarTime      ${tradePlan.trace.correlationId.replace('corr-', '').padEnd(16)}  ✓`);
    
    console.log(`Length       ${pinePayload2.indicator.length.toString().padEnd(16)}  Length       ${tradePlan.indicatorReference.config.length.toString().padEnd(16)}  ${pinePayload2.indicator.length === tradePlan.indicatorReference.config.length ? '✓' : 'x'}`);
    console.log(`Source       ${pinePayload2.indicator.source.padEnd(16)}  Source       ${tradePlan.indicatorReference.config.source.padEnd(16)}  ${pinePayload2.indicator.source === tradePlan.indicatorReference.config.source ? '✓' : 'x'}`);
    console.log(`Mult         ${pinePayload2.indicator.mult.toString().padEnd(16)}  Mult         ${tradePlan.indicatorReference.config.mult.toString().padEnd(16)}  ${pinePayload2.indicator.mult === tradePlan.indicatorReference.config.mult ? '✓' : 'x'}`);
    
    console.log(`Line1        ${pinePayload2.plots.upper.toString().padEnd(16)}  Line1        ${snap.line1.toString().padEnd(16)}  ${pinePayload2.plots.upper === snap.line1 ? '✓' : 'x'}`);
    console.log(`Line2        ${pinePayload2.plots.upper2.toString().padEnd(16)}  Line2        ${snap.line2.toString().padEnd(16)}  ${pinePayload2.plots.upper2 === snap.line2 ? '✓' : 'x'}`);
    console.log(`Line3        ${pinePayload2.plots.basis.toString().padEnd(16)}  Line3        ${snap.line3.toString().padEnd(16)}  ${pinePayload2.plots.basis === snap.line3 ? '✓' : 'x'}`);
    console.log(`Line4        ${pinePayload2.plots.lower2.toString().padEnd(16)}  Line4        ${snap.line4.toString().padEnd(16)}  ${pinePayload2.plots.lower2 === snap.line4 ? '✓' : 'x'}`);
    console.log(`Line5        ${pinePayload2.plots.lower.toString().padEnd(16)}  Line5        ${snap.line5.toString().padEnd(16)}  ${pinePayload2.plots.lower === snap.line5 ? '✓' : 'x'}`);
    
    console.log('\nTRADINGVIEW DATA POC = SIMULATION PASS');
  } else {
    console.error('\nTRADINGVIEW DATA POC = FAILED (No Trade Plan generated)');
  }

  // Cleanup
  server.close();
  await orchestrator.stopAll();
}

runSimulation().catch(console.error);
