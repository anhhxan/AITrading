const fs = require('fs');
const path = require('path');
const file = 'wait-webhooks.js';

const buffer = fs.readFileSync(file);
if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    console.log('UTF-16 LE detected. Converting to UTF-8...');
    const str = buffer.toString('utf16le');
    fs.writeFileSync(file, str, 'utf8');
    console.log('Successfully converted to UTF-8.');
} else {
    console.log('File is not UTF-16 LE');
}

