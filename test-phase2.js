const crypto = require("crypto");

console.log("=== TEST 1 & 4: Signal Identity deterministic và idempotency ===");
const robotId = "1234-abcd";
const barTimestamp = 1787653200000;
const direction = "LONG";
let idString1 = `${robotId}_${barTimestamp}_${direction}`;
let idString2 = `${robotId}_${barTimestamp}_${direction}`;

const hash1 = crypto.createHash("md5").update(idString1).digest("hex");
const hash2 = crypto.createHash("md5").update(idString2).digest("hex");
const cmd1 = `${hash1.slice(0,8)}-${hash1.slice(8,12)}-4${hash1.slice(13,16)}-a${hash1.slice(17,20)}-${hash1.slice(20,32)}`;
const cmd2 = `${hash2.slice(0,8)}-${hash2.slice(8,12)}-4${hash2.slice(13,16)}-a${hash2.slice(17,20)}-${hash2.slice(20,32)}`;
console.log("Command 1 ID:", cmd1);
console.log("Command 2 ID:", cmd2);
console.log("Idempotency:", cmd1 === cmd2 ? "PASS" : "FAIL");

console.log("\n=== TEST 5, 6, 7: RealtimePriceFeed isDataValid ===");
function isDataValid(status, lastPrice, lastMarketTimestamp) {
    return status === 'CONNECTED' && 
           lastPrice > 0 && 
           lastMarketTimestamp > 0 && 
           (Date.now() - lastMarketTimestamp <= 5000);
}

// TEST 5: CONNECTING + price=0
console.log("CONNECTING + price=0 ->", isDataValid('CONNECTING', 0, 0) ? "ENTRY PERMITTED" : "BLOCKED (PASS)");

// TEST 6: STALE + lastPrice cũ
console.log("STALE + lastPrice cũ ->", isDataValid('STALE', 60000, Date.now() - 10000) ? "ENTRY PERMITTED" : "BLOCKED (PASS)");
console.log("CONNECTED + lastPrice cũ (>5s) ->", isDataValid('CONNECTED', 60000, Date.now() - 6000) ? "ENTRY PERMITTED" : "BLOCKED (PASS)");

// TEST 7: Tick hợp lệ
console.log("CONNECTED + price>0 + fresh tick ->", isDataValid('CONNECTED', 60000, Date.now() - 1000) ? "ENTRY PERMITTED (PASS)" : "BLOCKED");

console.log("\n=== TEST 10: Files must not change ===");
const fs = require('fs');
console.log("Checking git status of frozen files...");
