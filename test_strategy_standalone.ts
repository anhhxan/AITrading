const { createClient } = require('@supabase/supabase-js');
const { BB_Strategy } = require('./src/core/plugins/strategies/BB_Strategy.ts');
require('dotenv').config({ path: '.env.local' });

async function runTest() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: cmd } = await supabase
    .from('robot_commands')
    .select('result')
    .eq('command_id', '96489a97-3506-4561-a727-f072b5a5a991')
    .single();

  const payload = cmd.result;
  
  const strategy = new BB_Strategy();
  strategy.init({});
  
  const indicatorSnapshot = {
    ready: true,
    line1: payload.plots.B1,
    line2: payload.plots.B2,
    line3: payload.plots.B3,
    line4: payload.plots.B4,
    line5: payload.plots.B5,
    config: payload.indicator
  };

  const previousSnapshot = {
    ready: true,
    line1: payload.previousPayload.plots.B1,
    line2: payload.previousPayload.plots.B2,
    line3: payload.previousPayload.plots.B3,
    line4: payload.previousPayload.plots.B4,
    line5: payload.previousPayload.plots.B5,
    config: payload.indicator
  };

  const context = {
    robotId: '7e95b9b5-e113-4d61-92a6-26c9979e7ebc',
    indicatorSnapshot,
    previousSnapshot,
    currentPrice: payload.close,
    currentHigh: payload.high,
    currentLow: payload.low,
    previousClose: payload.previousPayload.close
  };

  console.log("Evaluating BB_Strategy...");
  const result = strategy.evaluate(context);
  console.log("Result:", JSON.stringify(result, null, 2));
}

runTest().catch(console.error);
