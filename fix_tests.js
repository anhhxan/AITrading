const fs = require('fs');
const path = require('path');
const searchDir = 'src/core/__tests__';

function fixFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixFiles(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let changed = false;
      if (content.includes('params: {}')) {
        content = content.replace(/params:\s*\{\s*\}/g, "params: { length: 20, source: 'close', mult: 2.0, mult2: 1.0 }");
        changed = true;
      }
      if (content.includes('params: { length: 20, mult: 2 }')) {
        content = content.replace(/params:\s*\{\s*length:\s*20,\s*mult:\s*2\s*\}/g, "params: { length: 20, source: 'close', mult: 2.0, mult2: 1.0 }");
        changed = true;
      }
      if (content.includes('params: { length: 20, mult: 2, mult2: 1 }')) {
        content = content.replace(/params:\s*\{\s*length:\s*20,\s*mult:\s*2,\s*mult2:\s*1\s*\}/g, "params: { length: 20, source: 'close', mult: 2.0, mult2: 1.0 }");
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed:', fullPath);
      }
    }
  }
}
fixFiles(searchDir);
