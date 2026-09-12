const fs = require('fs');
let text = fs.readFileSync('src/core/engine/execution/PaperExecutionEngine.ts', 'utf8');

const newMethod = 
  public async executeDirectTradePlan(plan: any, signalId: string): Promise<{ status: string, orderId?: string, fillPrice?: number }> {
      // MOCK/PAPER execution
      console.log('[PaperExecutionEngine] Direct Execution for signal ' + signalId + ':', plan);
      
      // Mock successful execution
      return {
          status: 'EXECUTED',
          orderId: 'paper_' + signalId,
          fillPrice: plan.triggerPrice // mock fill
      };
  }
;

text = text.replace('public async handleTradePlan(event: TradePlanEvent) {', newMethod + '\n  public async handleTradePlan(event: TradePlanEvent) {');
fs.writeFileSync('src/core/engine/execution/PaperExecutionEngine.ts', text);
