const crypto = require("crypto");

console.log("=== CHECK 1: command_id pseudo-UUID ===");
const robotId = "r123";
const barTimestamp = 1787653200000;
const direction = "LONG";
let idString = `${robotId}_${barTimestamp}_${direction}`;
const hash = crypto.createHash("md5").update(idString).digest("hex");
const uuid = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
console.log(`Input: ${idString}`);
console.log(`Hash: ${hash}`);
console.log(`UUID: ${uuid}`);
const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[a][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
console.log(`Is valid UUID format for Supabase/Postgres: ${isUUID ? "YES (PASS)" : "NO (FAIL)"}`);

// Verify collisions (LONG vs SHORT)
const idStringShort = `${robotId}_${barTimestamp}_SHORT`;
const hashS = crypto.createHash("md5").update(idStringShort).digest("hex");
console.log(`UUID SHORT: ${hashS.slice(0,8)}-... (Collision: ${hash === hashS ? 'FAIL' : 'PASS'})`);

console.log("\n=== CHECK 3: LONG/SHORT Zone Numerical Test ===");
function calcLongZone(B3, B4, percent) {
    const distance = Math.abs(B4 - B3);
    const zoneValue = distance * (percent / 100);
    return { lower: B4 - zoneValue, upper: B4 };
}
function calcShortZone(B2, B3, percent) {
    const distance = Math.abs(B3 - B2);
    const zoneValue = distance * (percent / 100);
    return { lower: B2, upper: B2 + zoneValue };
}

const longZone = calcLongZone(100, 90, 10);
console.log(`LONG B3=100, B4=90: Zone = ${longZone.lower} -> ${longZone.upper}`);
console.log(`Expected: 89 -> 90. Match: ${longZone.lower === 89 && longZone.upper === 90 ? 'PASS' : 'FAIL'}`);

const shortZone = calcShortZone(110, 100, 10);
console.log(`SHORT B2=110, B3=100: Zone = ${shortZone.lower} -> ${shortZone.upper}`);
console.log(`Expected: 110 -> 111. Match: ${shortZone.lower === 110 && shortZone.upper === 111 ? 'PASS' : 'FAIL'}`);
