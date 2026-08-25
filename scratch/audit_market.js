const https = require('https');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '../../.env.local'});

function getBinanceKlines(symbol, interval, limit, endTime) {
    return new Promise((resolve, reject) => {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}${endTime ? '&endTime=' + endTime : ''}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => resolve(JSON.parse(data)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function fetchAllKlines() {
    let allKlines = [];
    let endTime = Date.now();
    for (let i = 0; i < 3; i++) {
        const klines = await getBinanceKlines('BTCUSDT', '1m', 1000, endTime);
        if (klines.length === 0) break;
        allKlines = klines.concat(allKlines);
        endTime = klines[0][0] - 1;
    }
    // format: [Open time, Open, High, Low, Close, Volume, Close time, ...]
    return allKlines.map(k => ({
        timestamp: k[0],
        close: parseFloat(k[4])
    }));
}

function calculateSMA(data, period) {
    let sma = new Array(data.length).fill(null);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i].close;
        if (i >= period) {
            sum -= data[i - period].close;
            sma[i] = sum / period;
        } else if (i === period - 1) {
            sma[i] = sum / period;
        }
    }
    return sma;
}

function calculateStdev(data, sma, period) {
    let stdev = new Array(data.length).fill(null);
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += Math.pow(data[i - j].close - sma[i], 2);
        }
        stdev[i] = Math.sqrt(sum / period);
    }
    return stdev;
}

async function main() {
    console.log('Fetching Binance data...');
    const data = await fetchAllKlines();
    const period = 20;
    const mult1 = 2.5;
    const mult2 = 1.3;
    
    const sma = calculateSMA(data, period);
    const stdev = calculateStdev(data, sma, period);
    
    const marketSignals = [];
    
    for (let i = period; i < data.length; i++) {
        const curr = data[i];
        const prev = data[i - 1];
        
        if (sma[i-1] === null || stdev[i-1] === null || sma[i] === null || stdev[i] === null) continue;
        
        const prevB5 = sma[i-1] - (stdev[i-1] * mult1);
        const prevB4 = sma[i-1] - (stdev[i-1] * mult2);
        const prevB2 = sma[i-1] + (stdev[i-1] * mult2);
        const prevB1 = sma[i-1] + (stdev[i-1] * mult1);
        
        const currB5 = sma[i] - (stdev[i] * mult1);
        const currB4 = sma[i] - (stdev[i] * mult2);
        const currB2 = sma[i] + (stdev[i] * mult2);
        const currB1 = sma[i] + (stdev[i] * mult1);
        
        const LONG_C1 = prev.close >= prevB5;
        const LONG_C2 = prev.close <= prevB4;
        const LONG_C3 = curr.close > currB4;
        
        const SHORT_C1 = prev.close >= prevB2;
        const SHORT_C2 = prev.close <= prevB1;
        const SHORT_C3 = curr.close < currB2;
        
        let signal = 'NONE';
        if (LONG_C1 && LONG_C2 && LONG_C3) signal = 'LONG';
        if (SHORT_C1 && SHORT_C2 && SHORT_C3) signal = 'SHORT';
        
        if (signal !== 'NONE') {
            marketSignals.push({
                timestamp: curr.timestamp,
                date: new Date(curr.timestamp).toISOString(),
                signal
            });
        }
    }
    
    console.log(`Market generated ${marketSignals.length} signals in the last ~3000 candles.`);
    console.log(marketSignals);
    
    console.log('Fetching database trace events count...');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { count: receivedCount } = await supabase.from('robot_commands').select('*', { count: 'exact', head: true }).eq('robot_id', 'f1610ab1-3177-4930-81fc-6cd98262d7b6').gte('created_at', new Date(data[0].timestamp).toISOString());
    console.log(`DB received ${receivedCount} commands in the same period.`);
}

main().catch(console.error);
