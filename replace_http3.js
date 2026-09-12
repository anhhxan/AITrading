const fs = require('fs');
let text = fs.readFileSync('src/worker/HttpServer.ts', 'utf8');

text = text.replace(/res\.end\(JSON\.stringify\(\{ status: 'ACCEPTED', message: 'Executed', fillPrice: executionResult\.fillPrice \}\)\);/, "res.end(JSON.stringify({ status: 'ACCEPTED', message: 'Executed', fillPrice: executionResult.fillPrice, executionResult }));");

fs.writeFileSync('src/worker/HttpServer.ts', text);
