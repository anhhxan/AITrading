import { getSupabaseAdmin } from '@/lib/supabase';
import { RuntimeManager } from './RuntimeManager';
import { coreEventBus } from '@/core/infrastructure/EventBus';
import { upsertSignalTrace } from '@/lib/diagnostics';
import { TradingPipeline } from '@/core/engine/pipeline/TradingPipeline';

export class CommandPoller {
    private isPolling = false;
    private currentDelay = 30000;
    private readonly minDelay = 30000;
    private readonly maxDelay = 60000;
    private timer: NodeJS.Timeout | null = null;
    private supabase = getSupabaseAdmin();
    private pipeline: TradingPipeline;

    constructor(private runtimeManager: RuntimeManager) {
        this.pipeline = new TradingPipeline(runtimeManager);
    }

    public start() {
        if (this.isPolling) return;
        this.isPolling = true;
        this.poll();
    }

    public stop() {
        this.isPolling = false;
        if (this.timer) clearTimeout(this.timer);
    }

    private async poll() {
        if (!this.isPolling) return;

        let foundCommand = false;
        try {
            const workerId = process.env.WORKER_ID || 'PAPER-WORKER-01';
            
            // Use RPC to atomically claim command
            const { data: commands, error } = await this.supabase.rpc('claim_robot_commands', {
                p_worker_id: workerId,
                p_limit: 1
            });

            if (error) {
                console.error('[CommandPoller] Polling error:', error.message || error);
            } else if (commands && commands.length > 0) {
                foundCommand = true;
                const fullCmd = commands[0];
                
                if (fullCmd.command_type === 'TV_SIGNAL' && fullCmd.result?.barTimestamp) {
                    upsertSignalTrace({
                        robot_id: fullCmd.robot_id,
                        bar_timestamp: Number(fullCmd.result.barTimestamp),
                        poller_status: 'GREEN'
                    });
                }

                console.log(JSON.stringify({
                    event: 'COMMAND_POLLER_CLAIMED',
                    command_id: fullCmd.command_id,
                    correlation_id: fullCmd.correlation_id,
                    robot_id: fullCmd.robot_id
                }));
                
                await this.processCommand(fullCmd);
            }
        } catch (err: any) {
            console.error('[CommandPoller] Exception in poll:', err.message || err);
        }

        if (this.isPolling) {
            if (foundCommand) {
                this.currentDelay = this.minDelay;
            } else {
                this.currentDelay = Math.min(this.currentDelay * 2, this.maxDelay);
            }
            this.timer = setTimeout(() => this.poll(), this.currentDelay);
        }
    }

    public async processCommand(cmd: any) {
        try {
            if (cmd.command_type === 'START') {
                await this.runtimeManager.getOrCreateRuntime(cmd.robot_id);
                // Worker updates state
                await this.supabase.from('robots').update({
                    status: 'RUNNING',
                    current_state: 'WAIT_SIGNAL',
                    trading_enabled: true
                }).eq('id', cmd.robot_id);
                
                await this.completeCommand(cmd.command_id, 'SUCCEEDED', { message: 'Started' });
            } 
            else if (cmd.command_type === 'STOP') {
                await this.runtimeManager.stopRuntime(cmd.robot_id);
                // Worker updates state
                await this.supabase.from('robots').update({
                    status: 'STOPPED',
                    current_state: 'IDLE',
                    trading_enabled: false
                }).eq('id', cmd.robot_id);
                
                await this.completeCommand(cmd.command_id, 'SUCCEEDED', { message: 'Stopped' });
            }
            else if (cmd.command_type === 'TV_SIGNAL') {
                const runtime = await this.runtimeManager.getOrCreateRuntime(cmd.robot_id);
                const payload = cmd.result; // payload was saved in result column initially
                
                // Fetch previous payload
                const { data: lastCmd } = await this.supabase
                    .from('robot_commands')
                    .select('result')
                    .eq('robot_id', cmd.robot_id)
                    .eq('command_type', 'TV_SIGNAL')
                    .eq('status', 'SUCCEEDED')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                
                if (lastCmd && lastCmd.result) {
                    payload.previousPayload = lastCmd.result.payload || lastCmd.result; 
                }

                                if (payload.isTest) {
                    console.log(`[WORKER] TEST_ID=${payload.testId}`);
                }
                
                const actualCorrelationId = payload.testId || cmd.correlation_id;

                const pipelineResult = await this.pipeline.processEntrySignal(cmd.robot_id, actualCorrelationId, payload);
                if (pipelineResult.status === 'ERROR') {
                     await this.completeCommand(cmd.command_id, 'FAILED', { error: pipelineResult.error });
                     return;
                }
                
                if (payload.isTest && payload.isE2E) {
                    const currentState = this.runtimeManager.stateMachine.getState(cmd.robot_id);
                    if (currentState === 'WAIT_CANDLE_B_CONFIRMATION' || currentState === 'READY_TO_ENTER') {
                        console.log(`[WORKER] Pumping Synthetic Prices for E2E: ${cmd.robot_id}`);
                        const { EventFactory } = require('../core/infrastructure/EventFactory');
                        const { SequenceAuthority } = require('../core/infrastructure/SequenceAuthority');
                        
                        const sendPrice = async (price: number) => {
                            let pSeq = SequenceAuthority.next(cmd.robot_id);
                            const pTrace = EventFactory.createTrace(actualCorrelationId, 'test-e2e', 'TestRunner', pSeq);
                            const priceEvent = EventFactory.createEvent('REALTIME_PRICE_EVENT', cmd.robot_id, 1, pTrace, { price, eventTimestamp: Date.now() });
                            await coreEventBus.publish(priceEvent as any);
                            await new Promise(r => setTimeout(r, 1000));
                        };

                        await new Promise(r => setTimeout(r, 1000));
                        await sendPrice(102); // ARM
                        await sendPrice(105); 
                        await sendPrice(103);
                        await sendPrice(101); // TRIGGER
                    } else {
                        console.log(`[WORKER] E2E Skipped Synthetic Prices because State is ${currentState}`);
                    }
                }
                
                await this.completeCommand(cmd.command_id, 'SUCCEEDED', payload);
            }
            else {
                await this.completeCommand(cmd.command_id, 'FAILED', { error: 'Unknown command_type' });
            }
        } catch (err: any) {
            console.log(JSON.stringify({
                event: 'COMMAND_POLLER_ERROR',
                command_id: cmd.command_id,
                correlation_id: cmd.correlation_id,
                safe_error: err.message || 'Unknown processing error'
            }));
            await this.completeCommand(cmd.command_id, 'FAILED', { error: err.message });
        }
    }

    private async completeCommand(commandId: string, status: 'SUCCEEDED' | 'FAILED', result: any) {
        await this.supabase.from('robot_commands').update({
            status,
            result
        }).eq('command_id', commandId);
    }
}


