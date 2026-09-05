const fs = require('fs');
const buf = fs.readFileSync('src/scripts/test-bb-flow.ts');
try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    console.log("Verified Valid UTF-8");
} catch (e) {
    console.log("Invalid UTF-8:", e.message);
}
