const fs = require('fs');
let text = fs.readFileSync('src/worker/HttpServer.ts', 'utf8');
text = text.replace(/console\.log\\\(\\\\\\[WorkerHttpServer\\\] Received signal_id \\\$\\\{payload.signal_id\\\} for robot \\\$\\\{robotId\\\} \\\(slug \\\$\\\{robotSlug\\\}\\\]\\\);/g, 'console.log([WorkerHttpServer] Received signal_id  for robot  (slug ));');
text = text.replace(/console.log\\\(\\\\[WorkerHttpServer\\\] Listening for direct webhooks on port \\\$\\\{port\\\}\\\\);/g, 'console.log([WorkerHttpServer] Listening for direct webhooks on port );');

fs.writeFileSync('src/worker/HttpServer.ts', text);
