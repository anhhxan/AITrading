const fs = require('fs');
const buf = fs.readFileSync('fix_utils.js');
let invalidUTF8 = false;
for (let i = 0; i < buf.length; i++) {
    if (buf[i] > 127) {
        console.log(`Byte ${buf[i].toString(16)} at index ${i}`);
        // simplistic check, TextDecoder throws if invalid
    }
}
try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    console.log("Valid UTF-8");
} catch (e) {
    console.log("Invalid UTF-8:", e.message);
}
