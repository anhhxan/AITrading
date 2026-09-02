const fs = require('fs');
let file = 'test_pine_v2.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = console.log("DB discipline PASS (No setups, No tick spam).");

    console.log("== 6. TICK 3: HIT STOP LOSS ==");
    const { EventFactory } = require('./src/core/infrastructure/EventFactory');
    const slEvent = EventFactory.createEvent('REALTIME_PRICE_EVENT', robotId, 1, EventFactory.createTrace('corr-1', 'test-event-sl', 'TestRunner', 6), {
        price: 60800,
        eventTimestamp: Date.now()
    });
    await coreEventBus.publish(slEvent as any);
    
    await new Promise(r => setTimeout(r, 5000));
    
    const { data: posAfterSL } = await supa.from('active_positions').select('*').eq('robot_id', robotId);
    if (posAfterSL && posAfterSL.length > 0) throw new Error('FAIL: Position not closed after SL.');
    
    console.log('Position correctly closed after SL.');
    console.log("ALL TESTS PASS!");
;

content = content.replace('console.log("DB discipline PASS (No setups, No tick spam).");\r\n    console.log("ALL TESTS PASS!");', replacement);
content = content.replace('console.log("DB discipline PASS (No setups, No tick spam).");\n    console.log("ALL TESTS PASS!");', replacement);

fs.writeFileSync(file, content);
