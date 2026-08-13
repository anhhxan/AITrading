const data = [];
for(let i=0; i<20; i++) data.push(100);

function getBands(closes) {
  const period = 20;
  const slice = closes.slice(-period);
  const sma = slice.reduce((a,b)=>a+b,0)/period;
  const variance = slice.reduce((a,b)=>a+Math.pow(b-sma, 2),0)/period;
  const std = Math.sqrt(variance);
  return { b1: sma+2*std, b2: sma+std, b3: sma, b4: sma-std, b5: sma-2*std };
}

for (let c1 = 90; c1 < 100; c1 += 0.1) {
    let d = [...data, c1];
    let bands1 = getBands(d);
    if (c1 >= bands1.b5 && c1 <= bands1.b4) {
        console.log("Found C1:", c1, bands1);
        let d2 = [...d, 105];
        let bands2 = getBands(d2);
        console.log("If C2 = 105, bands2=", bands2);
        break;
    }
}
