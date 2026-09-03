const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const { PluginLoader } = require('./src/core/plugins/PluginLoader');
const { BB_Strategy } = require('./src/core/plugins/strategies/BB_Strategy');

async function test() {
    PluginLoader.registerStrategy('BB_Strategy', BB_Strategy);
    const strategy = PluginLoader.loadStrategy('BB_Strategy');
    strategy.init({});
    
    const payload = {
        robotId: '7e95b9b5-e113-4d61-92a6-26c9979e7ebc',
        indicatorSnapshot: {
          line1: 78132.78,
          line2: 77809.45,
          line3: 77459.17,
          line4: 77108.89,
          line5: 76785.56
        },
        previousSnapshot: null,
        currentPrice: 77615.24,
        currentHigh: 77975.46,
        currentLow: 77608,
        previousClose: 77843.34
    };
    
    const signal = PluginLoader.safeEvaluateStrategy(strategy, payload);
    console.log(signal);
}
test();
