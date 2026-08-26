require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { error: posErr } = await supabase
          .from('active_positions')
          .insert({
            robot_id: '8bf86ec5-41a4-4d11-9998-d486d23db18b',
            symbol: 'BTCUSDT',
            side: 'LONG',
            quantity: 1,
            entry_price: 10000,
            leverage: 1,
            unrealized_pnl: 0,
            realized_pnl: 0,
            stop_loss_price: 9000,
            take_profit_price: 11000,
            correlation_id: 'test-trace',
            context_snapshot: {
              executionSymbol: 'BTCUSDT',
              tradingViewSymbol: 'BINANCE:BTCUSDT',
              timeframe: '15m',
              strategyId: 'TV_SIGNAL',
              indicatorSnapshot: {}
            }
          });
    console.log("PosErr:", posErr || "Success");
}
check();
