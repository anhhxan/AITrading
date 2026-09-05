const fs = require('fs');
const path = 'src/scripts/test-bb-flow.ts';
const buf = fs.readFileSync(path);
try {
    const text = new TextDecoder('windows-1252').decode(buf);
    fs.writeFileSync(path, text, 'utf8');
    console.log("Converted to UTF-8");
} catch(e) {
    console.log("Error:", e);
}
