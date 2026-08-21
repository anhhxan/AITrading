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
    trading_enabled: false, signal_source: 'TradingView'
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
    risk_profile: { max_position_size: 100, position_allocation_percent: 10, stop_loss_pct: 2.0 }, 
    entry_profile: { mode: 'MARKET' }, 
    exit_profile: { tp_mode: 'FIXED' }, 
    created_by: '00000000-0000-0000-0000-000000000001' 
  }).select('id').single(); 
  
  if (err2) throw err2; 
  console.log('Config created:', config.id); 
  
  console.log('3. Applying config...'); 
  const { error: err3 } = await supabase.rpc('apply_robot_config', { 
    p_robot_id: robot.id, 
    p_config_id: config.id 
  }); 
  
  if (err3) throw err3; 
  console.log('Config applied.'); 
  
  console.log('4. Starting robot...'); 
  const { error: err4 } = await supabase.from('robots').update({ 
    status: 'RUNNING', 
    trading_enabled: true 
  }).eq('id', robot.id); 
  
  if (err4) throw err4; 
  console.log('Robot started.'); 
  
  console.log('5. Sending real signal via webhook...'); 
  const payload = { action: 'BUY', tvSymbol: 'BINANCE:BTCUSDT.P', close: 100000, volume: 10 }; 
  const cfToken = process.env.CLOUDFLARE_PROXY_TOKEN; 
  const url = `https://tv-webhook-proxy.tradingbn.workers.dev/tv/${robot.id}/${cfToken}`;
  const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) }); 
  console.log('Webhook status:', res.status); 
  
  await new Promise(r => setTimeout(r, 4000)); 
  
  console.log('6. Checking results...'); 
  const { data: cmds } = await supabase.from('robot_commands').select('status, result').eq('robot_id', robot.id).order('created_at', { ascending: false }).limit(1); 
  console.log('Command:', cmds[0]); 
  
  const { data: intents } = await supabase.from('execution_intents').select('action, status').eq('robot_id', robot.id); 
  console.log('Intents:', intents); 
  
  const { data: positions } = await supabase.from('active_positions').select('symbol, side, quantity, entry_price').eq('robot_id', robot.id); 
  console.log('Positions:', positions); 

  console.log('7. Testing DUPLICATE protection...');
  const resDup = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
  console.log('Duplicate Webhook status:', resDup.status);
  await new Promise(r => setTimeout(r, 2000));
  const { data: cmdsDup } = await supabase.from('robot_commands').select('id').eq('robot_id', robot.id);
  console.log('Total commands:', cmdsDup.length);
  
  console.log('8. Testing REVERSAL...');
  const payloadSell = { action: 'SELL', tvSymbol: 'BINANCE:BTCUSDT.P', close: 95000, volume: 10 }; 
  const resSell = await fetch(url, { method: 'POST', body: JSON.stringify(payloadSell) });
  console.log('Sell Webhook status:', resSell.status);
  await new Promise(r => setTimeout(r, 4000));
  const { data: revPositions } = await supabase.from('active_positions').select('symbol, side, quantity, entry_price').eq('robot_id', robot.id); 
  console.log('Positions after Reversal:', revPositions); 
} 
run().catch(console.error);
