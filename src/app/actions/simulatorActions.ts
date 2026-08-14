'use server';

import { getSupabaseAdmin } from '../../lib/supabase';

export async function getOrCreateSimulatorRobot(userId: string, startingBalance: number) {
  const supabase = getSupabaseAdmin();
  const slug = `quick-paper-simulator-${userId}`;

  let { data: robot } = await supabase
    .from('robots')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!robot) {
    const { data: newRobot, error } = await supabase
      .from('robots')
      .insert({
        user_id: userId,
        name: 'Quick Paper Simulator',
        slug: slug,
        trading_mode: 'PAPER',
        trading_enabled: true, // MUST BE TRUE for webhook to process it
        status: 'RUNNING',
        current_state: 'WAIT_SIGNAL',
        timeframe: '15',
        signal_source: 'TRADINGVIEW',
        trading_view_symbol: 'BINANCE:BTCUSDT',
        execution_symbol: 'BTCUSDT',
        provider: 'BINANCE',
        trading_session: '24/7',
        paper_balance: startingBalance
      })
      .select('*')
      .single();

    if (error) throw new Error('Failed to create simulator robot: ' + error.message);
    robot = newRobot;

    // Create default config
    await supabase.from('robot_configs').insert({
      robot_id: robot.id,
      version: 1,
      status: 'ACTIVE',
      indicator_profile: { length: 20, source: 'close', mult: 2.0, mult2: 1.0 },
      strategy_profile: { type: 'BB_Strategy' },
      risk_profile: { max_allocation_percent: 100 },
      entry_profile: { type: 'MARKET' },
      exit_profile: { type: 'TAKE_PROFIT' }
    });
  }

  return robot;
}

export async function resetSimulator(userId: string, startingBalance: number = 10000) {
  const supabase = getSupabaseAdmin();
  const slug = `quick-paper-simulator-${userId}`;

  const { data: robot } = await supabase.from('robots').select('id').eq('slug', slug).single();
  if (!robot) return;

  await supabase.from('robot_commands').delete().eq('robot_id', robot.id);
  await supabase.from('trade_history').delete().eq('robot_id', robot.id);
  await supabase.from('active_positions').delete().eq('robot_id', robot.id);
  await supabase.from('active_orders').delete().eq('robot_id', robot.id);
  await supabase.from('execution_intents').delete().eq('robot_id', robot.id);
  
  await supabase.from('robots').update({ 
    paper_balance: startingBalance, 
    current_state: 'WAIT_SIGNAL' 
  }).eq('id', robot.id);
}

export async function updateSimulatorConfig(params: {
  robotId: string;
  tradingViewSymbol: string;
  executionSymbol: string;
  timeframe: string;
  bbLength: number;
  bbSource: string;
  bbMult: number;
  bbMult2: number;
}) {
  const supabase = getSupabaseAdmin();

  await supabase.from('robots').update({
    trading_view_symbol: params.tradingViewSymbol,
    execution_symbol: params.executionSymbol,
    timeframe: params.timeframe
  }).eq('id', params.robotId);

  // Invalidate old configs
  await supabase.from('robot_configs').update({ status: 'INACTIVE' }).eq('robot_id', params.robotId);

  // Insert new active config
  await supabase.from('robot_configs').insert({
    robot_id: params.robotId,
    version: Date.now(),
    status: 'ACTIVE',
    indicator_profile: { 
      length: params.bbLength, 
      source: params.bbSource, 
      mult: params.bbMult, 
      mult2: params.bbMult2 
    },
    strategy_profile: { type: 'BB_Strategy' },
    risk_profile: { max_allocation_percent: 100 },
    entry_profile: { type: 'MARKET' },
    exit_profile: { type: 'TAKE_PROFIT' }
  });
}

export async function sendSimulatedWebhook(params: {
  robotId: string;
  payload: any;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/webhook/tv/${params.robotId}`;
  const secret = process.env.TV_WEBHOOK_SECRET || 'secret';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`
    },
    body: JSON.stringify(params.payload)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Webhook Error (${res.status}): ${text}`);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }
  return json;
}
