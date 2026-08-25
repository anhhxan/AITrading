const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        if (file === 'node_modules' || file === '.git' || file === '.next') return;
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.json') || file.endsWith('.md')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('.');
let invalidFiles = [];

files.forEach(file => {
    try {
        const buffer = fs.readFileSync(file);
        if (buffer.length >= 2) {
            if ((buffer[0] === 0xFF && buffer[1] === 0xFE) || (buffer[0] === 0xFE && buffer[1] === 0xFF)) {
                invalidFiles.push({ file, type: 'UTF-16 BOM' });
                return;
            }
        }
        
        let isValid = true;
        for (let i = 0; i < buffer.length; i++) {
            const byte = buffer[i];
            if (byte <= 0x7F) continue;
            else if (byte >= 0xC2 && byte <= 0xDF) {
                if (i + 1 < buffer.length && (buffer[i + 1] & 0xC0) === 0x80) { i++; continue; }
            } else if (byte >= 0xE0 && byte <= 0xEF) {
                if (i + 2 < buffer.length && (buffer[i + 1] & 0xC0) === 0x80 && (buffer[i + 2] & 0xC0) === 0x80) {
                    if (byte === 0xE0 && buffer[i + 1] < 0xA0) {}
                    else if (byte === 0xED && buffer[i + 1] >= 0xA0) {}
                    else { i += 2; continue; }
                }
            } else if (byte >= 0xF0 && byte <= 0xF4) {
                if (i + 3 < buffer.length && (buffer[i + 1] & 0xC0) === 0x80 && (buffer[i + 2] & 0xC0) === 0x80 && (buffer[i + 3] & 0xC0) === 0x80) {
                    if (byte === 0xF0 && buffer[i + 1] < 0x90) {}
                    else if (byte === 0xF4 && buffer[i + 1] >= 0x90) {}
                    else { i += 3; continue; }
                }
            }
            isValid = false;
            break;
        }
        
        if (!isValid) {
            invalidFiles.push({ file, type: 'Invalid UTF-8 sequence' });
        }
    } catch (e) {}
});

console.log(invalidFiles);

