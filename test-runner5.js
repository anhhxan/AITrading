const { createClient } = require('@supabase/supabase-js'); 
require('dotenv').config({ path: 'C:/A/Tradding AI/trading-platform/.env.local' }); 
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); 

async function run() { 
  console.log('1. Creating new robot...'); 
  const { data: robot, error: err1 } = await supabase.from('robots').insert({ 
    name: 'Paper Test Bot', 
    slug: 'paper-test-bot-' + Date.now(), 
    user_id: '00000000-0000-0000-0000-000000000001', 
    current_state: 'IDLE', 
    status: 'CREATED', 
    trading_view_symbol: 'BINANCE:BTCUSDT.P', 
    execution_symbol: 'BTCUSDT', 
    timeframe: '15m', 
    provider: 'Binance Futures', 
    trading_mode: 'PAPER',
    trading_enabled: false,
    signal_source: 'TradingView',
    paper_balance: 10000,
    
  }).select('id').single(); 
  
  if (err1) throw err1; 
  console.log('Robot created:', robot.id); 
  
  console.log('2. Creating pending config...'); 
  const { data: config, error: err2 } = await supabase.from('robot_configs').insert({ 
    robot_id: robot.id, 
    version: 1, 
    status: 'PENDING', 
    indicator_profile: { length: 20, source: 'close', mult: 2.0, mult2: 1.0 }, 
    strategy_profile: { type: 'REVERSAL' }, 
    risk_profile: { max_position_size: 100, position_allocation_percent: 10, stop_loss_pct: 2.0,  }, 
    entry_profile: { mode: 'MARKET' }, 
    exit_profile: { tp_mode: 'FIXED' }, 
    created_by: '00000000-0000-0000-0000-000000000001' 
  }).select('id').single(); 
  
  if (err2) throw err2; 
  console.log('Config created:', config.id); 
  
  console.log('3. Applying config...'); 
  await supabase.from('robot_configs').update({ status: 'ACTIVE' }).eq('id', config.id);
  await supabase.from('robots').update({ active_config_version: 1 }).eq('id', robot.id);
  console.log('Config applied.'); 
  
  console.log('4. Starting robot...'); 
  const { error: err4 } = await supabase.from('robots').update({ 
    status: 'RUNNING', 
    trading_enabled: true 
  }).eq('id', robot.id); 
  
  if (err4) throw err4; 
  console.log('Robot started.'); 
  
  const cfToken = process.env.CLOUDFLARE_PROXY_TOKEN; 
  const url = `https://tv-webhook-proxy.tradingbn.workers.dev/tv/${robot.id}/${cfToken}`;

  console.log('5. Sending Webhook 1 (Setup Previous State)...'); 
  const payload1 = { 
    action: 'BUY', 
    tvSymbol: 'BINANCE:BTCUSDT.P', 
    timeframe: '15m',
    barTimestamp: Date.now() - 15 * 60000,
    open: 92000,
    high: 93000,
    low: 90000,
    close: 91000, 
    volume: 10,
    indicator: { length: 20, source: 'close', mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 98000, basis: 95000, lower2: 92000, lower: 90000 }
  }; 
  let res1 = await fetch(url, { method: 'POST', body: JSON.stringify(payload1) }); 
  console.log('Webhook 1 status:', res1.status); 
  await new Promise(r => setTimeout(r, 6000)); 

  console.log('6. Sending Webhook 2 (Trigger LONG)...'); 
  const payload2 = { 
    action: 'BUY', 
    tvSymbol: 'BINANCE:BTCUSDT.P', 
    timeframe: '15m',
    barTimestamp: Date.now(),
    open: 91000,
    high: 94000,
    low: 91000,
    close: 93000, 
    volume: 15,
    indicator: { length: 20, source: 'close', mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 98000, basis: 95000, lower2: 92000, lower: 90000 }
  }; 
  let res2 = await fetch(url, { method: 'POST', body: JSON.stringify(payload2) }); 
  console.log('Webhook 2 status:', res2.status); 
  await new Promise(r => setTimeout(r, 6000)); 

  console.log('7. Checking LONG results...'); 
  const { data: cmds } = await supabase.from('robot_commands').select('status, result').eq('robot_id', robot.id).is('parent_command_id', null).order('created_at', { ascending: false }).limit(2); 
  console.log('Last 2 Commands:', cmds.map(c => c.status)); 
  
  const { data: intents } = await supabase.from('execution_intents').select('action, status').eq('robot_id', robot.id); 
  console.log('Intents:', intents); 
  
  const { data: positions } = await supabase.from('active_positions').select('symbol, side, quantity, entry_price').eq('robot_id', robot.id); 
  console.log('Positions:', positions); 

  console.log('8. Testing REVERSAL (Trigger SHORT)...');
  const payload3 = { 
    action: 'SELL', 
    tvSymbol: 'BINANCE:BTCUSDT.P', 
    timeframe: '15m',
    barTimestamp: Date.now() + 15 * 60000,
    open: 93000,
    high: 100000,
    low: 93000,
    close: 99000, // setup for short: close between line1(100k) and line2(98k)
    volume: 10,
    indicator: { length: 20, source: 'close', mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 98000, basis: 95000, lower2: 92000, lower: 90000 }
  };
  let res3 = await fetch(url, { method: 'POST', body: JSON.stringify(payload3) }); 
  await new Promise(r => setTimeout(r, 6000)); 
  
  const payload4 = { 
    action: 'SELL', 
    tvSymbol: 'BINANCE:BTCUSDT.P', 
    timeframe: '15m',
    barTimestamp: Date.now() + 30 * 60000,
    open: 99000,
    high: 99000,
    low: 95000,
    close: 97000, // trigger short: drops below line2(98k)
    volume: 10,
    indicator: { length: 20, source: 'close', mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 98000, basis: 95000, lower2: 92000, lower: 90000 }
  };
  let res4 = await fetch(url, { method: 'POST', body: JSON.stringify(payload4) }); 
  console.log('Webhook 4 status:', res4.status); 
  await new Promise(r => setTimeout(r, 6000)); 
  
  const { data: revPositions } = await supabase.from('active_positions').select('symbol, side, quantity, entry_price').eq('robot_id', robot.id); 
  console.log('Positions after Reversal:', revPositions); 
} 
run().catch(console.error);
