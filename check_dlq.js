const { coreEventBus } = require('./dist/core/infrastructure/EventBus.js');
console.log(coreEventBus.getDeadLetterQueue('e0d00614-dfcc-4948-b840-340bfa0f8707'));
