const path = require('path');
const relativeImport = require('./src/core/infrastructure/EventBus');
const { coreEventBus: aliasImport } = require('./src/core/infrastructure/EventBus');

console.log("Are they exactly the same object?", relativeImport.coreEventBus === aliasImport);
console.log("Keys in require.cache:");
Object.keys(require.cache).filter(k => k.includes('EventBus')).forEach(k => console.log(k));
