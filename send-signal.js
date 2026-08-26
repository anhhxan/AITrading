fetch("http://localhost:3000/api/webhook/tv/8bf86ec5-41a4-4d11-9998-d486d23db18b", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer 6b836317269f4c43b2c4ff21004abbad"
    },
    body: JSON.stringify({
        direction: "LONG",
        symbol: "BINANCE:BTCUSDT",
        timeframe: "15",
        barTimestamp: Date.now(),
        bands: {
            B1: 120000,
            B2: 110000,
            B3: 100000,
            B4: 80000,
            B5: 70000
        }
    })
}).then(r => r.json()).then(console.log).catch(console.error);
