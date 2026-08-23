const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gixfypcwpeepjiqwlndk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  
  console.log('\n============================================================');
  console.log('FETCHING ALL TABLES');
  console.log('============================================================');
  
  const { data: tables, error } = await supabase.rpc('get_tables'); // Or try to query pg_tables directly if exposed, else let's try raw REST query
  
  // Actually let's just query some data
  console.log("Checking commands...");
  const commands = require('fs').readFileSync('commands_dump.json', 'utf8');
  const commandsData = JSON.parse(commands);
  
  let totalWebhook = commandsData.length;
  let received = commandsData.filter(c => c.status === 'RECEIVED').length;
  let processing = commandsData.filter(c => c.status === 'PROCESSING').length;
  let succeeded = commandsData.filter(c => c.status === 'SUCCEEDED' || c.status === 'COMPLETED').length;
  let failed = commandsData.filter(c => c.status === 'FAILED').length;
  
  console.log(`TOTAL WEBHOOK: ${totalWebhook}`);
  console.log(`TOTAL RECEIVED: ${received}`);
  console.log(`TOTAL PROCESSING: ${processing}`);
  console.log(`TOTAL SUCCEEDED: ${succeeded}`);
  console.log(`TOTAL FAILED: ${failed}`);
  
  console.log('\n============================================================');
  console.log('STRATEGY EVALUATION');
  console.log('============================================================');
  
  let strategyEvaluated = commandsData.filter(c => c.payload?.command === 'STRATEGY_EVALUATED');
  console.log(`STRATEGY_EVALUATED: ${strategyEvaluated.length}`);
  
  let long = 0, short = 0, none = 0, error_count = 0;
  
  for (const cmd of strategyEvaluated) {
     const res = cmd.payload?.result || cmd.payload?.signal || cmd.payload?.diagnostics?.result || 'NONE';
     if (res === 'LONG') long++;
     else if (res === 'SHORT') short++;
     else if (res === 'NONE') none++;
     else if (res === 'ERROR') error_count++;
     
     // Output table format
     // console.log(`Webhook: ${cmd.id} | Result: ${res} | correlation_id: ${cmd.correlation_id} | barTimestamp: ${cmd.payload?.diagnostics?.barTimestamp || cmd.payload?.barTimestamp}`);
  }
  
  console.log(`LONG: ${long}`);
  console.log(`SHORT: ${short}`);
  console.log(`NONE: ${none}`);
  console.log(`ERROR: ${error_count}`);
  
  // Specific trace for LONG command 0.025926635358101843
  console.log('\n============================================================');
  console.log('SPECIFIC TRACE');
  console.log('============================================================');
  const tradeHistoryStr = require('fs').readFileSync('trade_history_dump.json', 'utf8');
  const tradeHistory = JSON.parse(tradeHistoryStr);
  console.log('trade_history', tradeHistory);
  
  const execIntentsStr = require('fs').readFileSync('execution_intents_dump.json', 'utf8');
  const execIntents = JSON.parse(execIntentsStr);
  console.log('execution_intents', execIntents);
}

runAudit().catch(console.error);
