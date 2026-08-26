const fs = require('fs');
let code = fs.readFileSync('src/core/engine/runtime/RealtimePriceFeed.ts', 'utf8');

code = code.replace("import { coreEventBus } from '../../infrastructure/EventBus';", "import { coreEventBus } from '../../infrastructure/EventBus';\nimport { SequenceAuthority } from '../../infrastructure/SequenceAuthority';");

code = code.replace("private sequenceId = 0;", "");

code = code.replace(/this\.sequenceId\+\+;/g, "");

// In publishHeartbeat
code = code.replace(
    /const trace = EventFactory\.createTrace\([\s\S]*?`ws-heartbeat-\$\{this\.sequenceId\}`[\s\S]*?this\.sequenceId\n\s*\);/,
    `const seq = SequenceAuthority.next(this.robotId);
        const trace = EventFactory.createTrace(
            \`ws-heartbeat-\${seq}\`, 
            \`ws-agg-\${this.lastMarketTimestamp}\`,
            this.engineId,
            seq
        );`
);

// In publishEvent
code = code.replace(
    /const trace = EventFactory\.createTrace\([\s\S]*?`ws-\$\{this\.sequenceId\}`[\s\S]*?this\.sequenceId\n\s*\);/,
    `const seq = SequenceAuthority.next(this.robotId);
        const trace = EventFactory.createTrace(
            \`ws-\${seq}\`, 
            \`ws-agg-\${this.lastMarketTimestamp}\`,
            this.engineId,
            seq
        );`
);

// In publishEvent for sequenceId payload
code = code.replace(/sequenceId: this\.sequenceId/g, "sequenceId: seq");

// In logForensic
code = code.replace(
    /const trace = EventFactory\.createTrace\([\s\S]*?`ws-sys-\$\{Date\.now\(\)\}`[\s\S]*?0\n\s*\);/,
    `const seq = SequenceAuthority.next(this.robotId);
        const trace = EventFactory.createTrace(
            \`ws-sys-\${Date.now()}\`,
            'sys',
            this.engineId,
            seq
        );`
);

fs.writeFileSync('src/core/engine/runtime/RealtimePriceFeed.ts', code);
console.log("Replaced");
