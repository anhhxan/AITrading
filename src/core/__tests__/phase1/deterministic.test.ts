import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import { EventFactory, DecisionTrace } from '../../infrastructure/EventFactory';
import { Clock } from '../../infrastructure/Clock';
import { IdGenerator } from '../../infrastructure/IdGenerator';

describe('Phase 1 Foundation Correction: Deterministic Clock + ID Generation', () => {
  it('D1: Live mode vẫn sinh ID ngẫu nhiên', () => {
    Clock.reset();
    // Giả định IdGenerator cũng sẽ có hàm reset
    IdGenerator.reset();

    const trace1 = EventFactory.createTrace('corr', 'p1', 'eng', 1);
    const trace2 = EventFactory.createTrace('corr', 'p1', 'eng', 2);
    
    expect(trace1.traceId).not.toBe(trace2.traceId);
    
    const ev1 = EventFactory.createEvent('TEST', 'R1', trace1, {});
    const ev2 = EventFactory.createEvent('TEST', 'R1', trace2, {});

    expect(ev1.eventId).not.toBe(ev2.eventId);
  });

  it('D2: Replay mode sinh ra Canonical Hash giống hệt nhau ở 2 lần chạy', () => {
    const runDeterministic = () => {
      Clock.setTime(1620000000000);
      IdGenerator.setDeterministic('mock-uuid-base');

      const trace = EventFactory.createTrace('corr-hash', 'root', 'Engine', 1);
      const ev = EventFactory.createEvent('MOCK_EVENT', 'R-Hash', trace, { data: 123 });

      const hash = crypto.createHash('sha256').update(JSON.stringify(ev)).digest('hex');
      return hash;
    };

    const hash1 = runDeterministic();
    const hash2 = runDeterministic();

    expect(hash1).toBe(hash2);
  });
});
