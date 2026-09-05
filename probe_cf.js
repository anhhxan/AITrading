const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const robotId = 'e0d00614-dfcc-4948-b840-340bfa0f8707';
    const proxyBaseUrl = process.env.CLOUDFLARE_PROXY_URL || 'https://tv-webhook-proxy.tradingbn.workers.dev';
    const proxyToken = process.env.CLOUDFLARE_PROXY_TOKEN || '';
    const targetUrl = `${proxyBaseUrl}/tv/${robotId}/${proxyToken}`;
    const secret = process.env.TV_WEBHOOK_SECRET || '';
    
    const payload = {
        isTest: true,
        testId: "probe-cf-worker",
        timeframe: "1m",
        barTimestamp: 10000000,
        previousPayload: {
            isProvidedByTest: true,
            barTimestamp: 9940000
        },
        secret: secret
    };

    const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`
        },
        body: JSON.stringify(payload)
    });
    
    console.log("CF Status:", response.status);
    console.log("CF Response:", await response.text());
}
run();
