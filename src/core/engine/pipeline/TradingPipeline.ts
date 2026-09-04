import { RuntimeManager } from '@/worker/RuntimeManager';
import { getSupabaseAdmin } from '@/lib/supabase';


export class TradingPipeline {
    private supabase = getSupabaseAdmin();

    constructor(private runtimeManager: RuntimeManager) {}

    public async processEntrySignal(robotId: string, correlationId: string, payload: any) {
        console.log(`[TradingPipeline] Starting Direct Path for ${robotId}`);
        try {
            // 1. Adapter validation
            const result = await this.runtimeManager.adapter.handleWebhook(payload, robotId, correlationId);
            if (!result.accepted || !result.events) {
                console.log(`[TradingPipeline] Adapter rejected payload`);
                return { status: 'REJECTED' };
            }

            const candleEvent = result.events.find((e: any) => e.eventType === 'CANDLE_CLOSED')?.eventInstance;
            const indicatorEvent = result.events.find((e: any) => e.eventType === 'INDICATOR_UPDATED')?.eventInstance as any;

            if (candleEvent) {
                this.runtimeManager.strategyEngine.updateCandleDirect(candleEvent);
            }

            if (!indicatorEvent) return { status: 'NO_INDICATOR_DATA' };

            // 2. Strategy Engine (Direct)
            const signalEvent = await this.runtimeManager.strategyEngine.evaluateDirect(indicatorEvent);
            if (!signalEvent) {
                return { status: 'SKIPPED_NO_SIGNAL' };
            }

            // 3. State Machine Engine (Direct)
            const stateMachine = this.runtimeManager.stateMachine as any;
            await stateMachine.handleSignalDetected(signalEvent);

            // 3b. Immediately evaluate the close price to check ARM/TRIGGER
            if (payload.close) {
                const priceEvent = {
                    eventType: 'REALTIME_PRICE_EVENT',
                    robotId: robotId,
                    price: payload.close,
                    eventTimestamp: payload.barTimestamp,
                    trace: signalEvent.trace
                };
                
                const transitionEvent = await stateMachine.handleRealtimePrice(priceEvent);
                
                // 4. Risk Engine (Direct)
                if (transitionEvent && transitionEvent.payload?.newState === 'READY_TO_ENTER') {
                    const tradePlan = await (this.runtimeManager.riskEngine as any).handleReadyToEnter(transitionEvent);
                    
                    // 5. Paper Execution (Direct)
                    if (tradePlan) {
                         const execution = (this.runtimeManager as any).executionEngine || (this.runtimeManager as any).paperExecutionEngine || (this.runtimeManager as any).paperExecution;
                         if (execution && execution.handleTradePlan) {
                              await execution.handleTradePlan(tradePlan);
                         } else {
                              console.warn(`[TradingPipeline] Execution Engine not found on RuntimeManager!`);
                         }
                    }
                }
            }
            
            return { status: 'PIPELINE_COMPLETE' };
        } catch (error) {
            console.error(`[TradingPipeline] Error:`, error);
            return { status: 'ERROR', error };
        }
    }
}
