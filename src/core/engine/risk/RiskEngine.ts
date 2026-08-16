import { IEngine } from '../runtime/IEngine';
import { BaseEvent, EventFactory } from '../../infrastructure/EventFactory';
import { coreEventBus } from '../../infrastructure/EventBus';
import { StrategySignalEvent } from '../strategies/StrategyEngine';
import { StateTransitionEvent, RobotState } from '../runtime/StateMachineEngine';
import { calculateRiskPreview } from './RiskCalculator';

export interface TradePlanEvent extends BaseEvent {
  robotId: string;
  strategyId: string;
  strategyVersion: string;
  tradingViewSymbol: string;
  executionSymbol: string;
  timeframe: string;
  direction: 'LONG' | 'SHORT';
  
  triggerPrice: number;
  entryReferencePrice: number;
  stopLoss: number;
  takeProfit: number;
  
  accountBalance: number;
  positionAllocationPercent: number;
  positionValue: number;
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
  tradingViewSymbol: string;
  executionSymbol: string;
  timeframe: string;
  accountBalance: number;
  positionAllocationPercent: number;
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
      const rejEvent = EventFactory.createEvent('RISK_REJECTED_EVENT', robotId, event.configVersion || 1, trace, { reason, details });
      await coreEventBus.publish(rejEvent as any);
    };

    const config = this.robotConfigs.get(robotId);
    if (!config) return reject('MISSING_CONFIG');
    
    if (!config.tradingViewSymbol || !config.executionSymbol || !config.accountBalance || config.accountBalance <= 0 || 
        !config.positionAllocationPercent || config.positionAllocationPercent <= 0 || config.positionAllocationPercent > 100 ||
        !config.leverage || config.leverage <= 0) {
      return reject('INVALID_CONFIG');
    }

    const activeSignal = this.activeSignals.get(robotId);
    if (!activeSignal) return reject('MISSING_SIGNAL');

    const indicatorRef = activeSignal.indicatorReference;
    if (!indicatorRef || !indicatorRef.snapshot) return reject('MISSING_SNAPSHOT');

    const direction = activeSignal.direction;
    if (direction !== 'LONG' && direction !== 'SHORT') return reject('INVALID_DIRECTION');

    const entry = event.triggerPrice;

    let sl: number | null = null;
    let tp: number | null = null;

    if (direction === 'LONG') {
      sl = indicatorRef.snapshot.line5;
      tp = indicatorRef.snapshot.line3;
    } else {
      sl = indicatorRef.snapshot.line1;
      tp = indicatorRef.snapshot.line3;
    }

    const result = calculateRiskPreview({
      accountBalance: config.accountBalance,
      direction: direction as 'LONG' | 'SHORT',
      entryReferencePrice: entry,
      stopLoss: sl,
      takeProfit: tp,
      positionAllocationPercent: config.positionAllocationPercent,
      leverage: config.leverage
    });

    if (result.decision === 'RISK_REJECTED') {
      return reject(result.reason || 'REJECTED');
    }

    const positionSize = result.positionSize;
    const positionValue = result.riskAmount; // mapped inside RiskCalculator
    const rr = result.riskRewardRatio;

    const trace = EventFactory.createTrace(
      activeSignal.trace.correlationId,
      event.eventId,
      this.engineId,
      event.trace.sequence
    );

    const tradePlan = EventFactory.createEvent('TRADE_PLAN_EVENT', robotId, 1, trace, {
      strategyId: activeSignal.strategyId,
      strategyVersion: activeSignal.strategyVersion,
      tradingViewSymbol: config.tradingViewSymbol,
      executionSymbol: config.executionSymbol,
      timeframe: config.timeframe,
      direction: direction,
      triggerPrice: entry,
      entryReferencePrice: entry,
      stopLoss: sl,
      takeProfit: tp,
      accountBalance: config.accountBalance,
      positionAllocationPercent: config.positionAllocationPercent,
      positionValue: positionValue,
      positionSize: positionSize,
      leverage: config.leverage,
      riskRewardRatio: rr,
      indicatorReference: {
        ...indicatorRef,
        snapshot: {
          ...indicatorRef.snapshot,
          sizingContext: {
            positionAllocationPercent: config.positionAllocationPercent,
            positionValue: positionValue,
            quantity: positionSize,
            leverage: config.leverage
          }
        }
      }
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
