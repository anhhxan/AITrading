const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gixfypcwpeepjiqwlndk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg';

const supabase = createClient(supabaseUrl, supabaseKey);

const robotId = 'f1610ab1-3177-4930-81fc-6cd98262d7b6';

async function runAudit() {
  console.log('============================================================');
  console.log('1. ROBOT STATUS');
  console.log('============================================================');
  
  const { data: robot, error: robotErr } = await supabase
    .from('robots')
    .select('*')
    .eq('id', robotId)
    .single();
    
  if (robotErr) {
    console.error('Error fetching robot:', robotErr);
  } else {
    console.log(`robot_id: ${robot.id}`);
    console.log(`robot_name: ${robot.name}`);
    console.log(`timeframe: ${robot.timeframe || robot.config?.timeframe}`);
    console.log(`mode: ${robot.mode}`);
    console.log(`status: ${robot.status}`);
    console.log(`trading_enabled: ${robot.trading_enabled}`);
    console.log(`current_balance: ${robot.current_balance}`);
    console.log(`risk_profile: ${JSON.stringify(robot.risk_profile || robot.config?.risk)}`);
    // extract position_allocation_percent and leverage
    const risk = robot.risk_profile || robot.config?.risk || {};
    console.log(`position_allocation_percent: ${risk.position_allocation_percent || risk.positionAllocationPercent || risk.allocation}`);
    console.log(`leverage: ${risk.leverage}`);
  }

  console.log('\n============================================================');
  console.log('FETCHING RECENT COMMANDS');
  console.log('============================================================');
  
  // Last 48 hours to be safe
  const timeLimit = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: commands, error: commandsErr } = await supabase
    .from('robot_commands')
    .select('*')
    .eq('robot_id', robotId)
    .gte('created_at', timeLimit)
    .order('created_at', { ascending: false });

  if (commandsErr) {
    console.error('Error fetching commands:', commandsErr);
  } else {
    console.log(`Found ${commands.length} commands in last 48 hours.`);
    require('fs').writeFileSync('commands_dump.json', JSON.stringify(commands, null, 2));
    console.log('Commands dumped to commands_dump.json');
  }

  console.log('\n============================================================');
  console.log('FETCHING OTHER TABLES');
  console.log('============================================================');
  
  const tables = ['trade_history', 'execution_intents', 'active_orders', 'active_positions', 'diagnostics'];
  
  for (const table of tables) {
    const { data: tData, error: tErr } = await supabase
      .from(table)
      .select('*')
      .eq('robot_id', robotId)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (tErr) {
      // Some tables might not exist or use different names. Ignore errors or log them.
      console.error(`Error fetching ${table}:`, tErr.message);
    } else {
      require('fs').writeFileSync(`${table}_dump.json`, JSON.stringify(tData, null, 2));
      console.log(`Dumped ${tData.length} records from ${table}`);
    }
  }

  // Diagnostics sometimes is robot_diagnostics
  const { data: rdData, error: rdErr } = await supabase
    .from('robot_diagnostics')
    .select('*')
    .eq('robot_id', robotId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (!rdErr) {
    require('fs').writeFileSync(`robot_diagnostics_dump.json`, JSON.stringify(rdData, null, 2));
    console.log(`Dumped ${rdData.length} records from robot_diagnostics`);
  }

}

runAudit().catch(console.error);
