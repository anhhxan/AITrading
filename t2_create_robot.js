const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function createRobot() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // UUID from mapping for user
    const userId = '242e6c6f-402d-4a5f-95ea-caa8b8c926b3';
    
    // Robot data
    const robotData = {
        id: '20261111-0000-4000-a000-000000000001', // Fixed ID for test
        user_id: userId,
        name: 'Test Paper Robot',
        slug: 'test-paper-robot-1',
        status: 'RUNNING',
        current_state: 'IDLE',
        trading_mode: 'PAPER',
        timeframe: '1M',
        trading_view_symbol: 'BINANCE:BTCUSDT',
        execution_symbol: 'BTCUSDT',
        paper_balance: 10000
    };
    
    const { data: robot, error: rErr } = await supabase.from('robots').insert(robotData).select().single();
    if (rErr) {
        console.error('Failed to create robot:', rErr);
        process.exit(1);
    }
    
    const configData = {
        robot_id: robot.id,
        version: 1,
        strategy_profile: { "type": "BB_STRATEGY" },
        risk_profile: {
            "type": "FIXED_RISK",
            "position_size_pct": 20,
            "max_open_positions": 1,
            "stop_loss_pct": 2,
            "take_profit_pct": 4,
            "leverage": 1
        },
        indicator_profile: {
            "type": "BB_MB",
            "length": 20,
            "multiplier": 2,
            "source": "close"
        },
        entry_profile: { "type": "FIXED_ENTRY" },
        exit_profile: { "type": "FIXED_EXIT" },
        notification_profile: {}
    };
    
    const { data: config, error: cErr } = await supabase.from('robot_configs').insert(configData).select().single();
    if (cErr) {
        console.error('Failed to create config:', cErr);
        process.exit(1);
    }
    
    console.log('Robot created successfully:', robot.id);
}
createRobot();
