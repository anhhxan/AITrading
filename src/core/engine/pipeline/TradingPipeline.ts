import { RuntimeManager } from '@/worker/RuntimeManager';
import { getSupabaseAdmin } from '@/lib/supabase';
import { coreEventBus } from '@/core/infrastructure/EventBus';


export class TradingPipeline {
    private supabase = getSupabaseAdmin();

    private async saveObservabilityEvent(event: any) {
        try {
            const { error } = await this.supabase.from('core_events').insert({
                robot_id: event.robotId,
                event_id: event.eventId || ('evt_' + Math.random().toString(36).substr(2, 9)),
                event_type: event.eventType,
                correlation_id: event.trace?.correlationId || 'unknown',
                parent_id: event.trace?.parentId,
                event_sequence: event.trace?.sequence || 1,
                payload: event,
                timestamp: new Date().getTime()
            });
            if (error) throw error;
        } catch (e: any) {
            console.error(`[TradingPipeline] saveObservabilityEvent FAILED:`, {
                event_type: event.eventType,
                robot_id: event.robotId,
                event_id: event.eventId,
                error: e.message || String(e)
            });
        }
    }

    constructor(private runtimeManager: RuntimeManager) {}

    
    
    public async processDirectPaperDecision(robotId: string, correlationId: string, payload: any) {
        console.log(`[TradingPipeline] Starting DIRECT PAPER DECISION for ${robotId} | action=${payload.action}`);
        try {
            const execution = (this.runtimeManager as any).executionEngine || (this.runtimeManager as any).paperExecutionEngine || (this.runtimeManager as any).paperExecution;
            if (!execution) {
                console.error('[TradingPipeline] PaperExecutionEngine missing');
                return { status: 'ERROR', reason: 'MISSING_EXECUTION_ENGINE' };
            }

            // Guard: Check active position
            const { data: existingPos, error: checkErr } = await this.supabase
              .from('active_positions')
              .select('*')
              .eq('robot_id', robotId)
              .single();

            // Trace Event Setup
            const eventId = 'evt_' + Math.random().toString(36).substr(2, 9);
            const trace = { correlationId, parentId: null, sequence: 1 };

            await this.saveObservabilityEvent({
                eventId,
                eventType: 'TRADINGVIEW_SIGNAL_RECEIVED',
                robotId,
                trace,
                action: payload.action,
                payload
            });

            if (payload.action === 'ENTRY_LONG' || payload.action === 'ENTRY_SHORT') {
                if (existingPos) {
                    console.log(`[TradingPipeline] PAPER_ENTRY_IGNORED_ALREADY_IN_POSITION`);
                    await this.saveObservabilityEvent({
                        eventId: 'evt_' + Math.random().toString(36).substr(2, 9),
                        eventType: 'PAPER_ENTRY_IGNORED_ALREADY_IN_POSITION',
                        robotId,
                        trace,
                        action: payload.action
                    });
                    return { status: 'IGNORED', reason: 'ALREADY_IN_POSITION' };
                }

                // Check duplicate (idempotency via correlationId in active_positions or core_events)
                // We'll rely on the existingPos guard to prevent 2 positions, but what if race condition?
                // The DB should have a constraint on active_positions(robot_id) but for now we just checked existingPos.

                // Calculate Trade Plan variables
                const config = (this.runtimeManager as any).riskEngine?.robotConfigs?.get(robotId);
                if (!config) {
                    console.error(`[TradingPipeline] Config missing for ${robotId}`);
                    return { status: 'ERROR', reason: 'MISSING_CONFIG' };
                }

                const positionValue = config.accountBalance * ((config.positionAllocationPercent || 10) / 100) * (config.leverage || 1);
                const positionSize = positionValue / payload.entry_price;

                const tradePlan = {
                    eventId: 'evt_' + Math.random().toString(36).substr(2, 9),
                    eventType: 'TRADE_PLAN_EVENT',
                    robotId: robotId,
                    strategyId: payload.strategy || 'UNKNOWN',
                    strategyVersion: String(payload.config_version || 1),
                    tradingViewSymbol: payload.symbol || config.tradingViewSymbol,
                    executionSymbol: config.executionSymbol,
                    timeframe: payload.timeframe || config.timeframe,
                    direction: payload.action === 'ENTRY_LONG' ? 'LONG' : 'SHORT',
                    triggerPrice: payload.entry_price,
                    entryReferencePrice: payload.entry_price,
                    stopLoss: payload.stop_loss,
                    takeProfit: payload.take_profit,
                    accountBalance: config.accountBalance,
                    positionAllocationPercent: config.positionAllocationPercent,
                    positionValue: positionValue,
                    positionSize: positionSize,
                    leverage: config.leverage || 1,
                    orderType: 'MARKET',
                    indicatorReference: payload.indicator_snapshot,
                    trace: trace
                };

                await this.saveObservabilityEvent({
                    eventId: tradePlan.eventId,
                    eventType: 'PAPER_ENTRY_ACCEPTED',
                    robotId,
                    trace,
                    tradePlan
                });

                if (execution.handleTradePlan) {
                    await execution.handleTradePlan(tradePlan);
                }

                return { status: 'POSITION_OPENED' };

            } else if (payload.action === 'EXIT_LONG' || payload.action === 'EXIT_SHORT') {
                if (!existingPos) {
                    console.log(`[TradingPipeline] PAPER_EXIT_IGNORED_NO_POSITION`);
                    await this.saveObservabilityEvent({
                        eventId: 'evt_' + Math.random().toString(36).substr(2, 9),
                        eventType: 'PAPER_EXIT_IGNORED_NO_POSITION',
                        robotId,
                        trace,
                        action: payload.action
                    });
                    return { status: 'IGNORED', reason: 'NO_OPEN_POSITION' };
                }

                const expectedSide = payload.action === 'EXIT_LONG' ? 'LONG' : 'SHORT';
                if (existingPos.side !== expectedSide) {
                    console.log(`[TradingPipeline] PAPER_EXIT_IGNORED_SIDE_MISMATCH expected=${expectedSide} actual=${existingPos.side}`);
                    await this.saveObservabilityEvent({
                        eventId: 'evt_' + Math.random().toString(36).substr(2, 9),
                        eventType: 'PAPER_EXIT_IGNORED_SIDE_MISMATCH',
                        robotId,
                        trace,
                        action: payload.action,
                        actualSide: existingPos.side
                    });
                    return { status: 'IGNORED', reason: 'SIDE_MISMATCH' };
                }

                await this.saveObservabilityEvent({
                    eventId: 'evt_' + Math.random().toString(36).substr(2, 9),
                    eventType: 'PAPER_EXIT_ACCEPTED',
                    robotId,
                    trace,
                    action: payload.action
                });

                if (execution.closePosition) {
                    const exitPrice = payload.entry_price || payload.close || existingPos.entry_price; // use payload price or fallback
                    await execution.closePosition(robotId, correlationId, eventId, exitPrice, 'TRADINGVIEW_EXIT');
                }

                return { status: 'POSITION_CLOSED' };
            }
        } catch (error) {
            console.error(`[TradingPipeline] Direct Decision Error:`, error);
            return { status: 'ERROR', error };
        }
        return { status: 'IGNORED' };
    }

    public async processEntrySignal(robotId: string, correlationId: string, payload: any) {
        if (payload && payload.action && ['ENTRY_LONG', 'ENTRY_SHORT', 'EXIT_LONG', 'EXIT_SHORT'].includes(payload.action)) {
             return await this.processDirectPaperDecision(robotId, correlationId, payload);
        }
        
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
                await this.saveObservabilityEvent(candleEvent);
                this.runtimeManager.strategyEngine.updateCandleDirect(candleEvent);
            }

            if (!indicatorEvent) return { status: 'NO_INDICATOR_DATA' };
            await this.saveObservabilityEvent(indicatorEvent);

            // 2. Strategy Engine (Direct)
            const signalEvent = await this.runtimeManager.strategyEngine.evaluateDirect(indicatorEvent);
            if (signalEvent) {
                await this.saveObservabilityEvent(signalEvent);
            }
            const stateMachine = this.runtimeManager.stateMachine as any;
            if (signalEvent) {
                const riskEngine = this.runtimeManager.riskEngine as any;
                if (riskEngine && riskEngine.activeSignals && signalEvent.direction !== 'NONE') {
                    riskEngine.activeSignals.set(robotId, signalEvent);
                }
                await stateMachine.handleSignalDetected(signalEvent);
            }

            // 3b. Immediately evaluate the close price to check ARM/TRIGGER
            if (payload.close) {
                const trace = signalEvent ? signalEvent.trace : indicatorEvent.trace;
                const priceEvent = {
                    eventId: 'price_' + Math.random().toString(36).substr(2, 9),
                    eventType: 'REALTIME_PRICE_EVENT',
                    robotId: robotId,
                    price: payload.close,
                    eventTimestamp: payload.barTimestamp,
                    trace: trace
                };

                await this.saveObservabilityEvent(priceEvent);
                const transitionEvent = await stateMachine.handleRealtimePrice(priceEvent);

                // 4. Risk Engine (Direct)
                if (transitionEvent) {
                    await this.saveObservabilityEvent(transitionEvent);
                }
                if (transitionEvent && (transitionEvent as any).newState === 'READY_TO_ENTER') {
                    const tradePlan = await (this.runtimeManager.riskEngine as any).handleReadyToEnter(transitionEvent);

                    // 5. Paper Execution (Direct)
                    if (tradePlan) {
                         await this.saveObservabilityEvent(tradePlan);
                         const execution = (this.runtimeManager as any).executionEngine || (this.runtimeManager as any).paperExecutionEngine || (this.runtimeManager as any).paperExecution;
                         if (execution && execution.handleTradePlan) {
                              await execution.handleTradePlan(tradePlan);
                         } else {
                              console.warn(`[TradingPipeline] Execution Engine not found on RuntimeManager!`);
                         }
                    }
                }
            }

            if (!signalEvent) {
                return { status: 'PROCESSED_PRICE_ONLY' };
            }

            return { status: 'PIPELINE_COMPLETE' };
        } catch (error) {
            console.error(`[TradingPipeline] Error:`, error);
            return { status: 'ERROR', error };
        }
    }
}
