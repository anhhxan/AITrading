const fs = require('fs');
let file = 'src/core/engine/runtime/StateMachineEngine.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("handlePositionClosed(event: PositionClosedEvent) {\
", "handlePositionClosed(event: PositionClosedEvent) {\n");
content = content.replace("handlePositionOpened(event: PositionOpenedEvent) {\
", "handlePositionOpened(event: PositionOpenedEvent) {\n");
content = content.replace("handleRealtimePrice(event: any) {\
", "handleRealtimePrice(event: any) {\n");

fs.writeFileSync(file, content);
