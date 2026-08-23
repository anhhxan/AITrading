const fs = require('fs');

const commands = JSON.parse(fs.readFileSync('commands_dump.json', 'utf8'));

// Filter commands to timeframe = '1' (or '1m')
const commands1m = commands.filter(c => c.result?.timeframe === '1' || c.result?.timeframe === '1m');

let webhookCount = commands1m.length;
let totalReceived = commands1m.filter(c => c.status === 'RECEIVED').length;
let totalProcessing = commands1m.filter(c => c.status === 'PROCESSING').length;
let totalSucceeded = commands1m.filter(c => c.status === 'SUCCEEDED' || c.status === 'COMPLETED').length;
let totalFailed = commands1m.filter(c => c.status === 'FAILED').length;

console.log('--- 24H WEBHOOK ---');
console.log(`TOTAL WEBHOOK: ${webhookCount}`);
console.log(`TOTAL RECEIVED: ${totalReceived}`);
console.log(`TOTAL PROCESSING: ${totalProcessing}`);
console.log(`TOTAL SUCCEEDED: ${totalSucceeded}`);
console.log(`TOTAL FAILED: ${totalFailed}`);

let longC1Pass = 0, longC1Fail = 0;
let longC2Pass = 0, longC2Fail = 0;
let longC3Pass = 0, longC3Fail = 0;
let shortC1Pass = 0, shortC1Fail = 0;
let shortC2Pass = 0, shortC2Fail = 0;
let shortC3Pass = 0, shortC3Fail = 0;

let noneCount = 0;
let longCount = 0;
let shortCount = 0;

for (const cmd of commands1m) {
  if (cmd.command_type === 'TV_SIGNAL' && (cmd.status === 'SUCCEEDED' || cmd.status === 'COMPLETED')) {
    const res = cmd.result;
    if (res && res.plots && res.previousPayload && res.previousPayload.plots) {
      const prevClose = res.previousPayload.close;
      const currClose = res.close;
      const prevPlots = res.previousPayload.plots;
      const currPlots = res.plots;
      
      const pb1 = prevPlots.upper; // 2.5
      const pb2 = prevPlots.upper2; // 1.3
      const pb3 = prevPlots.basis;
      const pb4 = prevPlots.lower2; // -1.3
      const pb5 = prevPlots.lower; // -2.5

      const cb4 = currPlots.lower2;
      const cb2 = currPlots.upper2;

      // LONG logic:
      // C1: prevClose >= prevB5
      let lc1 = prevClose >= pb5;
      if (lc1) longC1Pass++; else longC1Fail++;
      
      // C2: prevClose <= prevB4
      let lc2 = prevClose <= pb4;
      if (lc2) longC2Pass++; else longC2Fail++;

      // C3: currClose > currB4
      let lc3 = currClose > cb4;
      if (lc3) longC3Pass++; else longC3Fail++;

      if (lc1 && lc2 && lc3) longCount++;

      // SHORT logic:
      // C1: prevClose >= prevB2
      let sc1 = prevClose >= pb2;
      if (sc1) shortC1Pass++; else shortC1Fail++;

      // C2: prevClose <= prevB1
      let sc2 = prevClose <= pb1;
      if (sc2) shortC2Pass++; else shortC2Fail++;

      // C3: currClose < currB2
      let sc3 = currClose < cb2;
      if (sc3) shortC3Pass++; else shortC3Fail++;

      if (sc1 && sc2 && sc3) shortCount++;
      
      if (!(lc1 && lc2 && lc3) && !(sc1 && sc2 && sc3)) {
        noneCount++;
      }
    } else {
        noneCount++;
    }
  }
}

console.log('--- BB STRATEGY AUDIT ---');
console.log(`LONG C1 PASS: ${longC1Pass}`);
console.log(`LONG C1 FAIL: ${longC1Fail}`);
console.log(`LONG C2 PASS: ${longC2Pass}`);
console.log(`LONG C2 FAIL: ${longC2Fail}`);
console.log(`LONG C3 PASS: ${longC3Pass}`);
console.log(`LONG C3 FAIL: ${longC3Fail}`);
console.log(`SHORT C1 PASS: ${shortC1Pass}`);
console.log(`SHORT C1 FAIL: ${shortC1Fail}`);
console.log(`SHORT C2 PASS: ${shortC2Pass}`);
console.log(`SHORT C2 FAIL: ${shortC2Fail}`);
console.log(`SHORT C3 PASS: ${shortC3Pass}`);
console.log(`SHORT C3 FAIL: ${shortC3Fail}`);

console.log(`LONG: ${longCount}`);
console.log(`SHORT: ${shortCount}`);
console.log(`NONE: ${noneCount}`);

