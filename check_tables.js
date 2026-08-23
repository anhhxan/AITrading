const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gixfypcwpeepjiqwlndk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const { data, error } = await supabase.from('robots').select('id').limit(1);
  if (error) console.error(error);
  
  // Try querying diagnostics
  const { data: d1, error: e1 } = await supabase.from('robot_diagnostics').select('*').limit(1);
  console.log('robot_diagnostics', e1 ? e1.message : d1.length);

  const { data: d2, error: e2 } = await supabase.from('diagnostics').select('*').limit(1);
  console.log('diagnostics', e2 ? e2.message : d2.length);

  // also signal_events or something
  const { data: d3, error: e3 } = await supabase.from('strategy_signals').select('*').limit(1);
  console.log('strategy_signals', e3 ? e3.message : d3.length);

  const { data: d4, error: e4 } = await supabase.from('trade_signals').select('*').limit(1);
  console.log('trade_signals', e4 ? e4.message : d4.length);
}

checkTables().catch(console.error);
