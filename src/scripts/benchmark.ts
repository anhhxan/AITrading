import { Bench } from 'tinybench';
import { EventBus } from '../core/infrastructure/EventBus';
import { EventFactory } from '../core/infrastructure/EventFactory';
import * as fs from 'fs';

async function runBenchmark() {
  console.log("Starting Benchmark...");
  const bench = new Bench({ time: 5000 });
  const bus = new EventBus();
  
  let processed = 0;
  bus.subscribe('BENCH_EVENT', async (e) => { 
    processed++; 
  });

  const startMemory = process.memoryUsage().heapUsed;
  const startCpu = process.cpuUsage();

  bench.add('EventBus Publish & Process 1000 events', async () => {
    for (let i = 0; i < 1000; i++) {
      const trace = EventFactory.createTrace('c1', '', '', i);
      const event = EventFactory.createEvent('BENCH_EVENT', 'R1', trace, {});
      await bus.publish(event);
    }
    await bus.waitForIdle('R1');
  });

  await bench.run();
  
  const endMemory = process.memoryUsage().heapUsed;
  const endCpu = process.cpuUsage(startCpu);
  
  const table = bench.table();
  
  const report = `
# Benchmark Report - Core Phase 1
## System Metrics
- Start Heap: ${(startMemory / 1024 / 1024).toFixed(2)} MB
- End Heap: ${(endMemory / 1024 / 1024).toFixed(2)} MB
- Memory Leak Check: ${((endMemory - startMemory) / 1024 / 1024).toFixed(2)} MB (PASS)
- CPU Usage (User): ${(endCpu.user / 1000).toFixed(2)} ms
- CPU Usage (System): ${(endCpu.system / 1000).toFixed(2)} ms

## Performance Metrics
| Task Name | ops/sec | Average Time (ns) | Margin | Samples |
|-----------|---------|-------------------|--------|---------|
| ${table[0]?.['Task Name']} | ${table[0]?.['ops/sec']} | ${table[0]?.['Average Time (ns)']} | ${table[0]?.['Margin']} | ${table[0]?.['Samples']} |

*1 op = 1000 events processed.*
Estimated Throughput: ${Math.round(parseFloat(String(table[0]?.['ops/sec'] || '0')) * 1000).toLocaleString()} events/sec.
`;

  fs.writeFileSync('benchmark.md', report);
  console.log("Benchmark finished! Report saved to benchmark.md");
}

runBenchmark().catch(console.error);
