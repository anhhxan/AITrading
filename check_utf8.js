const fs = require('fs');
const buffer = fs.readFileSync('wait-webhooks.js');
let isValid = true;
let invalidOffset = -1;
let invalidByte = -1;

for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    if (byte <= 0x7F) {
        continue; // ASCII
    } else if (byte >= 0xC2 && byte <= 0xDF) {
        if (i + 1 < buffer.length && (buffer[i + 1] & 0xC0) === 0x80) { i++; continue; }
    } else if (byte >= 0xE0 && byte <= 0xEF) {
        if (i + 2 < buffer.length && (buffer[i + 1] & 0xC0) === 0x80 && (buffer[i + 2] & 0xC0) === 0x80) {
            if (byte === 0xE0 && buffer[i + 1] < 0xA0) { /* overlong */ }
            else if (byte === 0xED && buffer[i + 1] >= 0xA0) { /* surrogate */ }
            else { i += 2; continue; }
        }
    } else if (byte >= 0xF0 && byte <= 0xF4) {
        if (i + 3 < buffer.length && (buffer[i + 1] & 0xC0) === 0x80 && (buffer[i + 2] & 0xC0) === 0x80 && (buffer[i + 3] & 0xC0) === 0x80) {
            if (byte === 0xF0 && buffer[i + 1] < 0x90) { /* overlong */ }
            else if (byte === 0xF4 && buffer[i + 1] >= 0x90) { /* out of bounds */ }
            else { i += 3; continue; }
        }
    }
    
    // If we reach here, it's invalid UTF-8
    isValid = false;
    invalidOffset = i;
    invalidByte = byte;
    break;
}

console.log('Valid UTF-8:', isValid);
if (!isValid) {
    console.log('Invalid Offset:', invalidOffset);
    console.log('Invalid Byte:', '0x' + invalidByte.toString(16).toUpperCase());
    
    // Show surrounding bytes and text
    const start = Math.max(0, invalidOffset - 20);
    const end = Math.min(buffer.length, invalidOffset + 20);
    console.log('Context (hex):', buffer.subarray(start, end).toString('hex'));
    console.log('Context (ascii):', buffer.subarray(start, end).toString('ascii').replace(/\n/g, '\\n'));
}

// Quick check for UTF-16 LE/BE BOM
if (buffer[0] === 0xFF && buffer[1] === 0xFE) console.log('Encoding: UTF-16 LE');
else if (buffer[0] === 0xFE && buffer[1] === 0xFF) console.log('Encoding: UTF-16 BE');
else if (!isValid) {
  // Check if it might be UTF-16 LE without BOM
  if (buffer[1] === 0x00 && buffer[3] === 0x00) {
    console.log('Encoding: Likely UTF-16 LE without BOM');
  } else {
    console.log('Encoding: ANSI / Windows-1252 / Other');
  }
}

