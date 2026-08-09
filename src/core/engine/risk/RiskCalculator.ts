export interface RiskCalculationParams {
  accountBalance: number;
  direction: 'LONG' | 'SHORT';
  entryReferencePrice: number | null | undefined;
  stopLoss: number | null | undefined;
  takeProfit: number | null | undefined;
  riskPercent: number;
  maxAllocationPercent: number;
  leverage: number;
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
    riskPercent,
    maxAllocationPercent,
    leverage
  } = params;

  const reject = (reason: string): RiskCalculationResult => ({
    decision: 'RISK_REJECTED',
    reason,
    risk: 0, reward: 0, riskRewardRatio: 0, riskAmount: 0, riskPerUnit: 0,
    positionSize: 0, maxNotional: 0, notional: 0
  });

  if (!accountBalance || accountBalance <= 0 ||
      !riskPercent || riskPercent <= 0 || riskPercent > 1 ||
      !maxAllocationPercent || leverage !== 1) {
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

  if (risk <= 0 || reward <= 0) return reject('INVALID_RISK_REWARD');

  const riskAmount = accountBalance * riskPercent;
  let positionSize = riskAmount / risk;

  if (!positionSize || positionSize <= 0 || !isFinite(positionSize) || isNaN(positionSize)) {
    return reject('INVALID_POSITION_SIZE');
  }

  const maxNotional = accountBalance * maxAllocationPercent;
  const notional = positionSize * entry;

  if (notional > maxNotional) {
    positionSize = maxNotional / entry;
  }

  const rr = reward / risk;

  return {
    decision: 'READY',
    risk,
    reward,
    riskRewardRatio: rr,
    riskAmount,
    riskPerUnit: risk,
    positionSize,
    maxNotional,
    notional: positionSize * entry
  };
}
