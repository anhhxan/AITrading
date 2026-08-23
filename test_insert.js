const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://gixfypcwpeepjiqwlndk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg");
async function run() {
  const { data: robot } = await supabase.from('robots').select('user_id').limit(1).single();
  const { data, error } = await supabase.from('robots').insert({
    name: 'Test 30m',
    slug: 'test-30m',
    user_id: robot.user_id,
    timeframe: '30m',
    signal_source: 'TRADING_VIEW',
    trading_view_symbol: 'BTCUSDT',
    execution_symbol: 'BTCUSDT',
    provider: 'BINANCE'
  }).select();
  console.log(error || data);
  if (data) {
    await supabase.from('robots').delete().eq('id', data[0].id);
  }
}
run();
