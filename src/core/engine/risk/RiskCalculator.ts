export interface RiskCalculationParams {
  accountBalance: number;
  direction: 'LONG' | 'SHORT';
  entryReferencePrice: number | null | undefined;
  stopLoss: number | null | undefined;
  takeProfit: number | null | undefined;
  riskPercent?: number; // legacy
  positionAllocationPercent: number;
  leverage?: number;
}

export interface RiskCalculationResult {
  decision: 'READY' | 'RISK_REJECTED';
  reason?: string;
  risk: number;
  reward: number;
  riskRewardRatio: number;
  riskAmount: number;
  riskPerUnit: number;
  positionSize: number;
  maxNotional: number;
  notional: number;
}

export function calculateRiskPreview(params: RiskCalculationParams): RiskCalculationResult {
  const {
    accountBalance,
    direction,
    entryReferencePrice: entry,
    stopLoss: sl,
    takeProfit: tp,
    positionAllocationPercent,
    leverage = 1
  } = params;

  const reject = (reason: string): RiskCalculationResult => ({
    decision: 'RISK_REJECTED',
    reason,
    risk: 0, reward: 0, riskRewardRatio: 0, riskAmount: 0, riskPerUnit: 0,
    positionSize: 0, maxNotional: 0, notional: 0
  });

  if (!accountBalance || accountBalance <= 0 ||
      !positionAllocationPercent || positionAllocationPercent <= 0 || positionAllocationPercent > 100) {
    return reject('INVALID_CONFIG');
  }

  if (!entry || entry <= 0 || isNaN(entry)) return reject('INVALID_ENTRY');
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

  if (risk <= 0 || reward <= 0) { console.log('RISK_REWARD FAILED: entry', entry, 'sl', sl, 'tp', tp, 'risk', risk, 'reward', reward); return reject('INVALID_RISK_REWARD'); }

  const positionValue = accountBalance * (positionAllocationPercent / 100);
  let positionSize = (positionValue * leverage) / entry;

  if (!positionSize || positionSize <= 0 || !isFinite(positionSize) || isNaN(positionSize)) {
    return reject('INVALID_POSITION_SIZE');
  }

  const notional = positionSize * entry;

  const rr = reward / risk;

  return {
    decision: 'READY',
    risk,
    reward,
    riskRewardRatio: rr,
    riskAmount: positionValue, // Map riskAmount to positionValue for legacy
    riskPerUnit: risk,
    positionSize,
    maxNotional: positionValue,
    notional: positionSize * entry
  };
}

