const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, '..', '..', 'src'));
let totalReplaced = 0;

files.forEach(f => {
  if (f.includes('EventFactory.ts')) return; // skip definition

  let content = fs.readFileSync(f, 'utf-8');
  let changed = false;

  // Regex to match EventFactory.createEvent(arg1, arg2, arg3, arg4)
  // We want to insert '1, ' before arg3.
  // Note: args could span multiple lines, but mostly they are single line or formatted.
  // This regex looks for EventFactory.createEvent( Type , RobotId , Trace , Payload )
  
  const regex = /EventFactory\.createEvent(<?[^>]*>?)?\(\s*([^,]+),\s*([^,]+),\s*([^,]+(?:createTrace[^,]+,[^,]+,[^,]+,[^)]+\)|[a-zA-Z0-9_.]+))\s*,/g;
  
  // We can do a simpler replace. Since the third argument is always the trace (which might contain commas if it's createTrace(...)),
  // Let's use a simpler approach: finding the string "EventFactory.createEvent" and parsing brackets.
  
  let i = 0;
  while ((i = content.indexOf('EventFactory.createEvent', i)) !== -1) {
    let openBrackets = 0;
    let commaIndices = [];
    let startIdx = content.indexOf('(', i);
    if (startIdx === -1) break;
    
    for (let j = startIdx + 1; j < content.length; j++) {
      if (content[j] === '(' || content[j] === '{' || content[j] === '[') openBrackets++;
      if (content[j] === ')' || content[j] === '}' || content[j] === ']') openBrackets--;
      
      if (content[j] === ',' && openBrackets === 0) {
        commaIndices.push(j);
      }
      
      if (openBrackets < 0) { // closing bracket of createEvent
        // if we found exactly 3 commas (meaning 4 arguments), we need to insert `1, ` after the second comma
        if (commaIndices.length === 3) {
           const insertPos = commaIndices[1] + 1;
           content = content.slice(0, insertPos) + ' 1 /* configVersion */,' + content.slice(insertPos);
           changed = true;
           totalReplaced++;
        }
        break;
      }
    }
    i = startIdx + 1; // Move forward
  }

  if (changed) {
    fs.writeFileSync(f, content, 'utf-8');
    console.log('Fixed', f);
  }
});

console.log('Total replaced:', totalReplaced);
