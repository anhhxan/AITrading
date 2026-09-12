import { coreEventBus as relative } from './src/core/infrastructure/EventBus';
import { coreEventBus as alias } from '@/core/infrastructure/EventBus';

console.log("Are they exactly the same object?", relative === alias);
console.log("Keys in require.cache:");
Object.keys(require.cache).filter(k => k.includes('EventBus')).forEach(k => console.log(k));
