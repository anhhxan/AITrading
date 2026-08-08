import * as crypto from 'crypto';
import { EventFactory } from '../core/infrastructure/EventFactory';
import { Clock } from '../core/infrastructure/Clock';
import { IdGenerator } from '../core/infrastructure/IdGenerator';

function runDeterministic() {
    Clock.setTime(1620000000000);
    IdGenerator.setDeterministic('deterministic-base');
    const trace = EventFactory.createTrace('t-1', 'root', 'Engine', 1);
    const ev = EventFactory.createEvent('MOCK_EVENT', 'R-1', trace, { payload: 'hello' });
    const str = JSON.stringify(ev);
    return crypto.createHash('sha256').update(str).digest('hex');
}

function runLive() {
    Clock.reset();
    IdGenerator.reset();
    const trace = EventFactory.createTrace('t-2', 'root', 'Engine', 1);
    const ev = EventFactory.createEvent('MOCK_EVENT', 'R-2', trace, { payload: 'hello' });
    return ev.eventId;
}

const hash1 = runDeterministic();
const hash2 = runDeterministic();

console.log('RUN 1 HASH:', hash1);
console.log('RUN 2 HASH:', hash2);
console.log('MATCH:', hash1 === hash2 ? 'YES' : 'NO');

const live1 = runLive();
const live2 = runLive();

console.log('LIVE ID 1:', live1);
console.log('LIVE ID 2:', live2);
console.log('LIVE UNIQUE MATCH:', live1 !== live2 ? 'YES (Unique)' : 'NO');
