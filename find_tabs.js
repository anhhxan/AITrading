const fs = require("fs");
const path = require("path");

const dir = "src/app/dashboard/robots/[id]";
const files = fs.readdirSync(dir);
console.log(files);

const pageContent = fs.readFileSync(path.join(dir, "page.tsx"), "utf8");
const lines = pageContent.split("\n");
lines.forEach((l, i) => {
  if(l.toLowerCase().includes("history") || l.toLowerCase().includes("log") || l.toLowerCase().includes("trade")) {
    console.log(i + ": " + l.trim());
  }
});
