const { calculateRiskPreview } = require('./src/core/engine/risk/RiskCalculator');

const mockConfig = {
    accountBalance: 10000,
    positionAllocationPercent: 10,
    leverage: 1
};

const result = calculateRiskPreview({
    direction: 'LONG',
    entryReferencePrice: 90000,
    stopLoss: 89000,
    takeProfit: 95000,
    accountBalance: mockConfig.accountBalance,
    positionAllocationPercent: mockConfig.positionAllocationPercent,
    leverage: mockConfig.leverage
});

console.log(JSON.stringify(result, null, 2));
