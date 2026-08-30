const fs = require('fs');
const path = require('path');

const tables = [
    'robots', 'robot_configs', 'active_setups', 'active_positions',
    'active_orders', 'execution_intents', 'trade_history',
    'robot_commands', 'core_events'
];

const targetCols = [
    'status', 'signal_source', 'trading_view_symbol', 'execution_symbol', 'provider',
    'indicator_profile', 'strategy_profile', 'risk_profile', 'entry_profile',
    'exit_profile', 'notification_profile', 'trading_session', 'trading_mode',
    'paper_balance', 'symbol', 'state', 'current_state', 'owner_id', 'user_id'
];

function walk(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const p = path.join(dir, file);
        if (fs.statSync(p).isDirectory()) {
            walk(p, fileList);
        } else if (p.endsWith('.ts') || p.endsWith('.tsx')) {
            fileList.push(p);
        }
    }
    return fileList;
}

const allFiles = [...walk('c:/A/Tradding AI/trading-platform/src'), ...walk('c:/A/Tradding AI/trading-platform/worker')];

const results = {};

allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    // Check tables
    tables.forEach(t => {
        if (content.includes(t)) {
            if (!results[t]) results[t] = [];
            if (!results[t].includes(file)) results[t].push(file);
        }
    });

    // Check specific columns
    targetCols.forEach(c => {
        if (content.includes(c)) {
            if (!results[c]) results[c] = [];
            if (!results[c].includes(file)) results[c].push(file);
        }
    });
});

fs.writeFileSync('C:\\Users\\pc\\.gemini\\antigravity\\brain\\e2d27aed-689b-4379-bf61-e6836f7d3f9c\\code_audit_raw.json', JSON.stringify(results, null, 2));
console.log('Done auditing codebase.');
