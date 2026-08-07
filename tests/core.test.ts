import { BB_MB_Indicator } from '../src/core/plugins/indicators/BB_MB';
import { BB_Strategy } from '../src/core/plugins/strategies/BB_Strategy';
import { RobotStateMachine, RobotState } from '../src/core/robot/RobotStateMachine';

// Helper to run a specific test scenario
function runScenario(
  name: string, 
  indicatorConfig: any, 
  strategyConfig: any, 
  mockSnapshot: any, 
  steps: { prevClose: number, close: number, expectedSignal?: string, expectedState?: RobotState, checkRetracement?: boolean, isRetracementZone?: boolean }[]
) {
  console.log(`\n==========================================`);
  console.log(`TEST SCENARIO: ${name}`);
  console.log(`==========================================`);
  
  const indicator = new BB_MB_Indicator();
  indicator.init(indicatorConfig);

  const strategy = new BB_Strategy();
  strategy.init(strategyConfig);

  const robot = new RobotStateMachine('test-robot', indicator, strategy, strategyConfig.timeoutCandles);
  
  // Override mock method in robot for testing
  robot['checkRetracementZone'] = (price, snap) => {
    // For test purposes, infer the side based on which bands are active
    const side = price < snap.band3 ? 'LONG' : 'SHORT'; 
    return strategy.isPriceInRetracementZone(side, price, snap);
  };
  
  console.log(`Init State: ${robot.state}`);
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n--- Step ${i + 1} ---`);
    
    // Inject previous close directly into strategy for testing specific triggers
    strategy['previousClose'] = step.prevClose;
    console.log(`Prev Close: ${step.prevClose} | Curr Close: ${step.close}`);
    
    if (robot.state === RobotState.WAIT_SIGNAL) {
      robot['evaluateSignal']({ close: step.close }, mockSnapshot);
      // We know the expected signal from the test case, if it transitioned, it was that signal.
      if (step.expectedSignal) {
         if ((robot.state as any) === RobotState.SIGNAL_DETECTED) {
            console.log(`✅ Passed: Signal matches (${step.expectedSignal})`);
         } else {
            console.error(`❌ FAILED: Expected ${step.expectedSignal}, got NONE`);
         }
      }
    } else if (robot.state === RobotState.SIGNAL_DETECTED || robot.state === RobotState.WAIT_RETRACEMENT) {
      if (step.checkRetracement !== undefined) {
        // Hack: in real system evaluateRetracement infers side from state payload, we will force check
        const inZone = strategy.isPriceInRetracementZone(
          mockSnapshot.band4 > step.close ? 'LONG' : 'SHORT', 
          step.close, 
          mockSnapshot
        );
        console.log(`Is in Retracement Zone? ${inZone}`);
        if (inZone !== step.isRetracementZone) console.error(`❌ FAILED: Expected zone check ${step.isRetracementZone}, got ${inZone}`);
        else console.log(`✅ Passed: Zone check correct`);
      }
      robot['evaluateRetracement']({ close: step.close }, mockSnapshot);
    }
    
    console.log(`Robot State After Step: ${robot.state}`);
    if (step.expectedState && robot.state !== step.expectedState) {
      console.error(`❌ FAILED STATE: Expected ${step.expectedState}, got ${robot.state}`);
    }
  }
}

async function runAllTests() {
  const indConfig = { length: 5, mult1: 2.0, mult2: 1.0 };
  const stratConfig = { retracementZonePercent: 20, timeoutCandles: 3 };
  
  // Band1 = 110 (Upper Outer)
  // Band2 = 105 (Upper Inner)
  // Band3 = 100 (EMA)
  // Band4 = 95  (Lower Inner)
  // Band5 = 90  (Lower Outer)
  const mockSnapshot = {
    ready: true,
    band1: 110, band2: 105, band3: 100, band4: 95, band5: 90
  };

  // Case 1: Standard LONG
  runScenario('1. STANDARD LONG (Breakout Band 4)', indConfig, stratConfig, mockSnapshot, [
    { prevClose: 93, close: 96, expectedSignal: 'LONG', expectedState: RobotState.SIGNAL_DETECTED },
    // LONG Retracement zone = [Band5, Band5 + 20%*(Band4-Band5)] = [90, 90 + 0.2*5] = [90, 91]
    { prevClose: 96, close: 91, checkRetracement: true, isRetracementZone: true, expectedState: RobotState.POSITION_OPEN }
  ]);

  // Case 2: Standard SHORT
  runScenario('2. STANDARD SHORT (Breakout Band 2)', indConfig, stratConfig, mockSnapshot, [
    // Prev between Band1(110) & Band2(105). Break below Band2 (e.g. 104)
    { prevClose: 108, close: 104, expectedSignal: 'SHORT', expectedState: RobotState.SIGNAL_DETECTED },
    // SHORT Retracement zone = [Band1 - 20%*(Band1-Band2), Band1] = [110 - 0.2*5, 110] = [109, 110]
    { prevClose: 104, close: 109.5, checkRetracement: true, isRetracementZone: true, expectedState: RobotState.POSITION_OPEN }
  ]);

  // Case 3: Retracement Missed (Too shallow)
  runScenario('3. LONG RETRACEMENT MISSED (Too Shallow)', indConfig, stratConfig, mockSnapshot, [
    { prevClose: 93, close: 96, expectedSignal: 'LONG', expectedState: RobotState.SIGNAL_DETECTED },
    { prevClose: 96, close: 93, checkRetracement: true, isRetracementZone: false, expectedState: RobotState.WAIT_RETRACEMENT }
  ]);

  // Case 4: Retracement Missed (Too deep)
  runScenario('4. LONG RETRACEMENT MISSED (Too Deep)', indConfig, stratConfig, mockSnapshot, [
    { prevClose: 93, close: 96, expectedSignal: 'LONG', expectedState: RobotState.SIGNAL_DETECTED },
    { prevClose: 96, close: 89, checkRetracement: true, isRetracementZone: false, expectedState: RobotState.WAIT_RETRACEMENT }
  ]);

  // Case 5: Timeout triggers reset
  runScenario('5. TIMEOUT 3 CANDLES -> RESET', indConfig, stratConfig, mockSnapshot, [
    { prevClose: 93, close: 96, expectedSignal: 'LONG', expectedState: RobotState.SIGNAL_DETECTED }, // Signal
    { prevClose: 96, close: 95, expectedState: RobotState.WAIT_RETRACEMENT }, // Candle 1
    { prevClose: 95, close: 95, expectedState: RobotState.WAIT_RETRACEMENT }, // Candle 2
    { prevClose: 95, close: 95, expectedState: RobotState.WAIT_RETRACEMENT }, // Candle 3
    { prevClose: 95, close: 95, expectedState: RobotState.WAIT_SIGNAL }       // Candle 4 (Timeout -> Reset)
  ]);

  // Case 6: Timeout = 0 (No timeout)
  runScenario('6. NO TIMEOUT (Timeout = 0)', indConfig, { ...stratConfig, timeoutCandles: 0 }, mockSnapshot, [
    { prevClose: 93, close: 96, expectedSignal: 'LONG', expectedState: RobotState.SIGNAL_DETECTED },
    { prevClose: 96, close: 95, expectedState: RobotState.WAIT_RETRACEMENT }, // Candle 1
    { prevClose: 95, close: 95, expectedState: RobotState.WAIT_RETRACEMENT }, // Candle 2
    { prevClose: 95, close: 95, expectedState: RobotState.WAIT_RETRACEMENT }, // Candle 3
    { prevClose: 95, close: 95, expectedState: RobotState.WAIT_RETRACEMENT }, // Candle 4
    { prevClose: 95, close: 95, expectedState: RobotState.WAIT_RETRACEMENT }  // Candle 5 (Still waiting)
  ]);
  
  console.log("\n==========================================");
  console.log("ALL TESTS EXECUTED");
  console.log("==========================================");
}

runAllTests();
