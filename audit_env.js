require('dotenv').config({ path: '.env.local' });
console.log("Secret:", process.env.TV_WEBHOOK_SECRET ? "Exists" : "Missing");
console.log("CF URL:", process.env.CLOUDFLARE_PROXY_URL);
console.log("CF Token:", process.env.CLOUDFLARE_PROXY_TOKEN);
