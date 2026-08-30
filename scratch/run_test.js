
const crypto = require('crypto');

async function run() {
  const robotId = '33f9c37d-64ef-4a01-8aa3-05a1d897c193'; // we'll use an existing one or create a new one
  const API_URL = 'http://localhost:3000/api/webhook/tv';
  const SECRET = '6b836317269f4c43b2c4ff21004abbad';

  async function sendWebhook(event, direction, open, close, ts) {
      const payload = {
          secret: SECRET,
          setup_id: '1787148720000_BTCUSDT',
          event: event,
          direction: direction,
          state: 'ARM_' + direction,
          symbol: 'BTCUSDT',
          timeframe: '15m',
          barTimestamp: ts,
          eventTimestamp: Date.now(),
          bands: { B1: 110, B2: 105, B3: 100, B4: 95, B5: 90 },
          trigger: 98,
          stop: 92
      };
      
      const res = await fetch(API_URL + '/' + robotId, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });
      console.log('Sent ' + event + ', Response:', res.status);
      const text = await res.text();
      console.log(text);
  }

  console.log('Sending ARM...');
  await sendWebhook('ARM', 'LONG', 100, 99, Date.now() - 60000);
  
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Sending FIRE...');
  await sendWebhook('FIRE', 'LONG', 99, 97, Date.now());
}
run();
