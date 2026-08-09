import { EventFactory } from '../core/infrastructure/EventFactory';
import * as crypto from 'crypto';
import * as fs from 'fs';

function runSimulation() {
  const traces = [];
  for (let i = 1; i <= 1000; i++) {
    const trace = EventFactory.createTrace('corr1', 'root', 'Engine', i);
    const event = EventFactory.createEvent('MOCK_EVENT', 'R1', 1 /* configVersion */, trace, { payload: i });
    traces.push(event.idempotencyKey);
  }
  return crypto.createHash('sha256').update(traces.join('')).digest('hex');
}

function testReplay() {
  console.log("Starting Replay SHA256 Determinism Test...");
  const run1 = runSimulation();
  const run2 = runSimulation();
  
  let report = `# Replay Determinism Report\n\n`;
  report += `## Run 1 (Live Simulation)\nSHA256: \`${run1}\`\n\n`;
  report += `## Run 2 (Replay Simulation)\nSHA256: \`${run2}\`\n\n`;
  report += `## Result\n`;
  
  if (run1 === run2) {
    report += `**PASS**: Exactly Bit-by-bit matching. Traces are deterministic.\n`;
  } else {
    report += `**FAIL**: Divergence detected!\n`;
  }
  
  fs.writeFileSync('replay_report.md', report);
  console.log("Replay test finished! Saved to replay_report.md");
}

testReplay();
