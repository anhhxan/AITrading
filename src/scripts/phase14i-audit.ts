import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseAdmin } from '../lib/supabase';

async function audit() {
  const supabase = getSupabaseAdmin();
  const robotId = 'f1610ab1-3177-4930-81fc-6cd98262d7b6';

  console.log(`\n==================================================`);
  console.log(`6. PRODUCTION ROBOT STATE`);
  console.log(`==================================================`);
  const { data: robot } = await supabase.from('robots').select('*').eq('id', robotId).single();
  console.log(`Robot State: ${robot?.current_state}`);
  console.log(`Trading Mode: ${robot?.trading_type}`);
  console.log(`Trading Enabled: ${robot?.status === 'ACTIVE'}`);

  const { data: lastWebhook } = await supabase.from('webhook_events').select('created_at').eq('robot_id', robotId).order('created_at', { ascending: false }).limit(1);
  console.log(`Last Webhook: ${lastWebhook?.[0]?.created_at}`);

  const { data: lastCandle } = await supabase.from('core_events').select('timestamp').eq('robot_id', robotId).eq('event_type', 'CANDLE_CLOSED').order('timestamp', { ascending: false }).limit(1);
  console.log(`Last Candle: ${lastCandle?.[0] ? new Date(lastCandle[0].timestamp).toISOString() : 'N/A'}`);

  const { data: lastSignal } = await supabase.from('core_events').select('timestamp').eq('robot_id', robotId).eq('event_type', 'STRATEGY_SIGNAL_EVENT').order('timestamp', { ascending: false }).limit(1);
  console.log(`Last Signal: ${lastSignal?.[0] ? new Date(lastSignal[0].timestamp).toISOString() : 'N/A'}`);

  const { data: lastTransition } = await supabase.from('core_events').select('timestamp, payload').eq('robot_id', robotId).eq('event_type', 'STATE_TRANSITION_EVENT').order('timestamp', { ascending: false }).limit(1);
  console.log(`Last STATE_TRANSITION_EVENT: ${lastTransition?.[0] ? new Date(lastTransition[0].timestamp).toISOString() + ' -> ' + lastTransition[0].payload.newState : 'N/A'}`);

  const { data: lastRiskReject } = await supabase.from('core_events').select('timestamp, payload').eq('robot_id', robotId).eq('event_type', 'RISK_REJECTED_EVENT').order('timestamp', { ascending: false }).limit(1);
  console.log(`Last RISK_REJECTED_EVENT: ${lastRiskReject?.[0] ? new Date(lastRiskReject[0].timestamp).toISOString() + ' -> ' + lastRiskReject[0].payload.reason : 'N/A'}`);

  const { data: lastIntent } = await supabase.from('execution_intents').select('*').eq('robot_id', robotId).order('created_at', { ascending: false }).limit(1);
  console.log(`Last EXECUTION_INTENT_CREATED: ${lastIntent?.[0]?.created_at || 'N/A'}`);

  const { data: lastPos } = await supabase.from('active_positions').select('*').eq('robot_id', robotId).order('created_at', { ascending: false }).limit(1);
  console.log(`Last Active Position: ${lastPos?.[0]?.created_at || 'N/A'}`);

  console.log(`\n==================================================`);
  console.log(`7,8,9,10,11. PRODUCTION EVENT CHAIN & FORENSIC`);
  console.log(`==================================================`);
  
  const { data: events } = await supabase.from('core_events')
    .select('*')
    .eq('robot_id', robotId)
    .order('event_sequence', { ascending: false })
    .limit(100);

  if (events) {
    events.reverse();
    for (const e of events) {
      if (e.event_type === 'STRATEGY_SIGNAL_EVENT' || e.event_type === 'STATE_TRANSITION_EVENT' || e.event_type === 'RISK_REJECTED_EVENT' || e.event_type === 'CANDLE_CLOSED' || e.event_type === 'TRADE_PLAN_EVENT' || e.event_type === 'EXECUTION_INTENT_CREATED' || e.event_type === 'POSITION_OPENED_EVENT') {
        const time = new Date(e.timestamp).toISOString();
        if (e.event_type === 'STRATEGY_SIGNAL_EVENT') {
            console.log(`\n[${time}] SIGNAL [${e.event_sequence}] -> ${e.payload.direction} | ${JSON.stringify(e.payload.entryTrigger)}`);
        } else if (e.event_type === 'CANDLE_CLOSED') {
            console.log(`[${time}] CANDLE [${e.event_sequence}] -> O:${e.payload.candle.open} H:${e.payload.candle.high} L:${e.payload.candle.low} C:${e.payload.candle.close}`);
        } else if (e.event_type === 'STATE_TRANSITION_EVENT') {
            console.log(`[${time}] TRANSITION [${e.event_sequence}] -> ${e.payload.previousState} -> ${e.payload.newState} | Reason: ${e.payload.reason} | TriggerPrice: ${e.payload.triggerPrice}`);
        } else if (e.event_type === 'RISK_REJECTED_EVENT') {
            console.log(`[${time}] RISK_REJECTED [${e.event_sequence}] -> Reason: ${e.payload.reason}`);
        } else if (e.event_type === 'TRADE_PLAN_EVENT') {
            console.log(`[${time}] TRADE_PLAN [${e.event_sequence}] -> Price: ${e.payload.entryReferencePrice}`);
        } else if (e.event_type === 'EXECUTION_INTENT_CREATED') {
            console.log(`[${time}] INTENT_CREATED [${e.event_sequence}] -> Price: ${e.payload.price} | OrderType: ${e.payload.orderType}`);
        } else if (e.event_type === 'POSITION_OPENED_EVENT') {
            console.log(`[${time}] POSITION_OPENED [${e.event_sequence}] -> EntryPrice: ${e.payload.entryPrice}`);
        }
      }
    }
  }

  console.log(`\n==================================================`);
  console.log(`12. CONFIGURATION VERIFICATION`);
  console.log(`==================================================`);
  const { data: config } = await supabase.from('robot_configs').select('*').eq('robot_id', robotId).order('version', { ascending: false }).limit(1);
  console.log(`Config: ${JSON.stringify(config?.[0])}`);

  console.log(`\n==================================================`);
  console.log(`13. WEBHOOK CONTINUITY`);
  console.log(`==================================================`);
  const { data: webhooks } = await supabase.from('core_events').select('timestamp').eq('robot_id', robotId).eq('event_type', 'CANDLE_CLOSED').order('timestamp', { ascending: false }).limit(50);
  if (webhooks && webhooks.length > 0) {
    let lastTime = new Date(webhooks[webhooks.length - 1].timestamp).getTime();
    for (let i = webhooks.length - 2; i >= 0; i--) {
        const time = new Date(webhooks[i].timestamp).getTime();
        const delta = (time - lastTime) / 1000;
        let mark = '';
        if (delta > 600) mark = ' [> 10 minutes gap]';
        else if (delta > 300) mark = ' [> 5 minutes gap]';
        else if (delta > 120) mark = ' [> 2 minutes gap]';
        console.log(`Candle at ${new Date(webhooks[i].timestamp).toISOString()}: delta = ${delta}s${mark}`);
        lastTime = time;
    }
  }

}
audit().catch(console.error);
