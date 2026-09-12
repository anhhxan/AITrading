async function getPrice() {
  const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
  const data = await res.json();
  console.log("BTC PRICE:", data.price);
}
getPrice();
