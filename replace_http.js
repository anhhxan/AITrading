const fs = require('fs');
let text = fs.readFileSync('src/worker/HttpServer.ts', 'utf8');

text = text.replace(/import \{ MockIdempotencyManager, RedisIdempotencyManager, IIdempotencyManager \} from '\.\.\/core\/infrastructure\/IdempotencyManager';/, "import { FileIdempotencyManager, IIdempotencyManager } from '../core/infrastructure/IdempotencyManager';");
text = text.replace(/this\.idempotency = new MockIdempotencyManager\(\);/, "this.idempotency = new FileIdempotencyManager();");

fs.writeFileSync('src/worker/HttpServer.ts', text);
