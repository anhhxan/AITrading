const fs = require("fs");
const page = fs.readFileSync("src/app/dashboard/robots/[id]/page.tsx", "utf8");
const lines = page.split("\n");
let queryBlock = [];
let capturing = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(".from('trade_history')")) {
    capturing = true;
  }
  if (capturing) {
    queryBlock.push(lines[i]);
    if (lines[i].includes("await") || queryBlock.length > 10) {
      if (lines[i].includes(";")) capturing = false;
    }
  }
}
console.log(queryBlock.join("\n"));
