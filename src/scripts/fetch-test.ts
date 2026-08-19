import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function test() {
  const secret = process.env.TV_WEBHOOK_SECRET;
  const url = `https://tv-webhook-proxy.tradingbn.workers.dev/api/webhook/tv/f1610ab1-3177-4930-81fc-6cd98262d7b6/${secret}`;
  console.log('Fetching', url);
  const r1 = await fetch(url, { method: 'POST', body: '{}' });
  console.log(r1.status, await r1.text());
}
test();
