const fs = require('fs');

function replaceTimestamps(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    // Replace 10-digit timestamps (e.g. 1234567890) with 13-digit timestamps (e.g. 1724019200000)
    // Be careful not to replace other things. 
    // In our tests, signal_timestamp: 1234567890 or 1600000000
    content = content.replace(/signal_timestamp:\s*\d{10}/g, 'signal_timestamp: 1724019200000');
    content = content.replace(/"signal_timestamp":\s*\d{10}/g, '"signal_timestamp": 1724019200000');
    // signal_id also uses 10-digit sometimes
    content = content.replace(/signal_id:\s*['"]\d{10}_(?:LONG|SHORT)['"]/g, match => match.replace(/\d{10}/, '1724019200000'));
    content = content.replace(/"signal_id":\s*['"]\d{10}_(?:LONG|SHORT)['"]/g, match => match.replace(/\d{10}/, '1724019200000'));
    fs.writeFileSync(filePath, content, 'utf8');
}

replaceTimestamps('src/core/__tests__/phase1/entry_signal.test.ts');
replaceTimestamps('src/core/__tests__/phase1/webhook_direct.test.ts');
replaceTimestamps('src/core/__tests__/phase2/direct_entry.test.ts');

