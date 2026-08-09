import { IEngine } from '../runtime/IEngine';
import { BaseEvent, EventFactory } from '../../infrastructure/EventFactory';
import { coreEventBus } from '../../infrastructure/EventBus';
import { StrategySignalEvent } from '../strategies/StrategyEngine';
import { StateTransitionEvent, RobotState } from '../runtime/StateMachineEngine';

export interface TradePlanEvent extends BaseEvent {
  robotId: string;
  strategyId: string;
  strategyVersion: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  
  triggerPrice: number;
  entryReferencePrice: number;
  stopLoss: number;
  takeProfit: number;
  
  accountBalance: number;
  riskPercent: number;
  riskAmount: number;
  maxAllocationPercent: number;
  positionSize: number;
  leverage: number;
  riskRewardRatio: number;
  
  indicatorReference: {
    name: string;
    config: any;
    snapshot: any;
  };
}

export interface RiskRejectedEvent extends BaseEvent {
  robotId: string;
  reason: string;
  details: any;
}

export interface RiskConfig {
  symbol: string;
  accountBalance: number;
  riskPercent: number;
  maxAllocationPercent: number;
  leverage: number;
}

export class RiskEngine implements IEngine {
  public engineId = 'RiskEngine_1';
  private status: 'READY' | 'STARTING' | 'ERROR' | 'STOPPED' = 'STOPPED';
  
  private robotConfigs: Map<string, RiskConfig> = new Map();
  private activeSignals: Map<string, StrategySignalEvent> = new Map();
  
  private unsubs: (() => void)[] = [];

  public async initialize(): Promise<void> {
    this.status = 'STARTING';
    
    this.unsubs.push(coreEventBus.subscribe('STRATEGY_SIGNAL_EVENT', async (e: StrategySignalEvent) => {
       if (e.direction !== 'NONE') {
         this.activeSignals.set(e.robotId, e);
       }
    }));

    this.unsubs.push(coreEventBus.subscribe('STATE_TRANSITION_EVENT', async (e: StateTransitionEvent) => {
       if (e.newState === RobotState.READY_TO_ENTER) {
         await this.handleReadyToEnter(e);
       }
    }));

    this.status = 'READY';
  }

  public registerRobotConfig(robotId: string, config: RiskConfig) {
    this.robotConfigs.set(robotId, config);
  }

  private async handleReadyToEnter(event: StateTransitionEvent) {
    const robotId = event.robotId;
    console.log('[RiskEngine] handleReadyToEnter called for', robotId);
    
    const reject = async (reason: string, details?: any) => {
      console.log('[RiskEngine] REJECTED:', reason, details);
      const trace = EventFactory.createTrace(
        event.trace.correlationId,
        event.eventId,
        this.engineId,
        event.trace.sequence
      );
      const rejEvent = EventFactory.createEvent('RISK_REJECTED_EVENT', robotId, trace, { reason, details });
      await coreEventBus.publish(rejEvent as any);
    };

    const config = this.robotConfigs.get(robotId);
    if (!config) return reject('MISSING_CONFIG');
    
    if (!config.symbol || !config.accountBalance || config.accountBalance <= 0 || 
        !config.riskPercent || config.riskPercent <= 0 || config.riskPercent > 1 ||
        !config.maxAllocationPercent || config.leverage !== 1) {
      return reject('INVALID_CONFIG');
    }

    const activeSignal = this.activeSignals.get(robotId);
    if (!activeSignal) return reject('MISSING_SIGNAL');

    const indicatorRef = activeSignal.indicatorReference;
    if (!indicatorRef || !indicatorRef.snapshot) return reject('MISSING_SNAPSHOT');

    const direction = activeSignal.direction;
    if (direction !== 'LONG' && direction !== 'SHORT') return reject('INVALID_DIRECTION');

    const entry = event.triggerPrice;
    if (!entry || entry <= 0 || isNaN(entry)) return reject('INVALID_ENTRY');

    let sl: number;
    let tp: number;

    if (direction === 'LONG') {
      sl = indicatorRef.snapshot.line5;
      tp = indicatorRef.snapshot.line3;
    } else {
      sl = indicatorRef.snapshot.line1;
      tp = indicatorRef.snapshot.line3;
    }

    if (!sl || sl <= 0 || isNaN(sl)) return reject('INVALID_SL');
    if (!tp || tp <= 0 || isNaN(tp)) return reject('INVALID_TP');

    let risk: number;
    let reward: number;

    if (direction === 'LONG') {
      risk = entry - sl;
      reward = tp - entry;
    } else {
      risk = sl - entry;
      reward = entry - tp;
    }

    if (risk <= 0 || reward <= 0) return reject('INVALID_RISK_REWARD');

    const riskAmount = config.accountBalance * config.riskPercent;
    let positionSize = riskAmount / risk;

    if (!positionSize || positionSize <= 0 || !isFinite(positionSize) || isNaN(positionSize)) {
      return reject('INVALID_POSITION_SIZE');
    }

    const maxNotional = config.accountBalance * config.maxAllocationPercent;
    const notional = positionSize * entry;

    if (notional > maxNotional) {
      positionSize = maxNotional / entry;
    }

    const rr = reward / risk;

    const trace = EventFactory.createTrace(
      activeSignal.trace.correlationId,
      event.eventId,
      this.engineId,
      event.trace.sequence
    );

    const tradePlan = EventFactory.createEvent('TRADE_PLAN_EVENT', robotId, trace, {
      strategyId: activeSignal.strategyId,
      strategyVersion: activeSignal.strategyVersion,
      symbol: config.symbol,
      direction: direction,
      triggerPrice: entry,
      entryReferencePrice: entry,
      stopLoss: sl,
      takeProfit: tp,
      accountBalance: config.accountBalance,
      riskPercent: config.riskPercent,
      riskAmount: riskAmount,
      maxAllocationPercent: config.maxAllocationPercent,
      positionSize: positionSize,
      leverage: config.leverage,
      riskRewardRatio: rr,
      indicatorReference: indicatorRef
    });

    console.log('[RiskEngine] Emitting TRADE_PLAN_EVENT for', robotId, 'posSize:', positionSize);
    await coreEventBus.publish(tradePlan as any);
  }

  public healthCheck(): any {
    return { status: this.status };
  }

  public ready(): boolean { 
    return this.status === 'READY'; 
  }

  public async shutdown(): Promise<void> {
    for (const unsub of this.unsubs) unsub();
    this.unsubs = [];
    this.status = 'STOPPED';
  }
}
