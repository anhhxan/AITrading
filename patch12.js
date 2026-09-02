const fs = require('fs');
let file = 'test_pine_v2.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace("upper2: 64000", "B1: 64000")
                 .replace("upper: 63000", "B2: 63000")
                 .replace("basis: 62000", "B3: 62000")
                 .replace("lower: 61000", "B4: 61000")
                 .replace("lower2: 60000", "B5: 60000");

const slLogic = console.log('== 6. TICK 3: HIT STOP LOSS ==');
  await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', robotId, 1, EventFactory.createTrace('corr-1', 'test-event-sl', 'TestRunner', 6), {
    price: 60800,
    eventTimestamp: Date.now()
  } as any));
  
  await new Promise(r => setTimeout(r, 5000));
  
  const { data: posAfterSL } = await supa.from('active_positions').select('*').eq('robot_id', robotId);
  if (posAfterSL.length > 0) throw new Error('FAIL: Position not closed after SL.');
  
  console.log('Position correctly closed after SL.');
  console.log('ALL TESTS PASS!');;

content = content.replace("console.log('ALL TESTS PASS!');", slLogic);
content = content.replace("await new Promise(r => setTimeout(r, 2000));", "await new Promise(r => setTimeout(r, 5000));");

fs.writeFileSync(file, content);
