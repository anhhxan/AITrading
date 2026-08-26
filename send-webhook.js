const http = require('http');

const payload = JSON.stringify({
    direction: "SHORT",
    symbol: "BINANCE:BTCUSDT",
    timeframe: "15",
    barTimestamp: Date.now(),
    bands: {
        B1: 79500,
        B2: 79300,
        B3: 79100,
        B4: 78900,
        B5: 78700
    }
});

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/webhook/tv/8bf86ec5-41a4-4d11-9998-d486d23db18b',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Response:', res.statusCode, data));
});

req.on('error', console.error);
req.write(payload);
req.end();
