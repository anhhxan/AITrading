const fs = require('fs');
let text = fs.readFileSync('src/worker/HttpServer.ts', 'utf8');

text = text.replace(/if \(executionResult\.status === 'EXECUTED'\)/, "if (['FILLED', 'PARTIAL_FILL', 'PROTECTION_PENDING', 'EXECUTED'].includes(executionResult.status))");
text = text.replace(/res\.end\(JSON\.stringify\(\{ status: 'ACCEPTED' \}\)\);/, "res.end(JSON.stringify({ status: 'ACCEPTED', executionResult }));");

fs.writeFileSync('src/worker/HttpServer.ts', text);
