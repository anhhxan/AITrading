require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const payload = {
    direction: "LONG",
    symbol: "BINANCE:BTCUSDT",
    timeframe: "15",
    barTimestamp: Date.now(),
    bands: {
        B1: 79500,
        B2: 79300,
        B3: 78680,
        B4: 78880,
        B5: 78400
    }
};

const robotId = '8bf86ec5-41a4-4d11-9998-d486d23db18b';
const rawString = `${robotId}_${payload.barTimestamp}_${payload.direction}`;
const hash = crypto.createHash('md5').update(rawString).digest('hex');
const deterministicCommandId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;

async function run() {
    console.log("Injecting Test Signal...");
    const { error } = await supabase.from('robot_commands').insert({
        robot_id: robotId,
        command_id: deterministicCommandId,
        command_type: 'TV_SIGNAL',
        status: 'RECEIVED',
        correlation_id: `tv_golden_${Date.now()}`,
        result: payload
    });
    console.log("Insert result:", error || "SUCCESS");
}
run();
