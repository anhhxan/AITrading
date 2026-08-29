import { getSupabaseAdmin } from '@/lib/supabase';
import { RuntimeManager } from './RuntimeManager';
import { coreEventBus } from '@/core/infrastructure/EventBus';
import { upsertSignalTrace } from '@/lib/diagnostics';

export class CommandPoller {
    private isPolling = false;
    private timer: NodeJS.Timeout | null = null;
    private supabase = getSupabaseAdmin();

    constructor(private runtimeManager: RuntimeManager) {}

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

        try {
            // Find one PENDING command
            const { data: commands, error } = await this.supabase
                .from('robot_commands')
                .select('command_id, robot_id, command_type, created_at')
                .eq('status', 'RECEIVED')
                .order('created_at', { ascending: true })
                .limit(1);

            if (error) {
                console.error('[CommandPoller] Polling error:', error);
            } else if (commands && commands.length > 0) {
                const cmdStub = commands[0];
                
                // Optimistic lock: update to PROCESSING without selecting the full row back
                const { error: lockErr } = await this.supabase
                    .from('robot_commands')
                    .update({ status: 'PROCESSING', processed_at: new Date().toISOString() })
                    .eq('command_id', cmdStub.command_id)
                    .eq('status', 'RECEIVED');

                if (!lockErr) {
                    // Fetch the full command including the payload
                    const { data: fullCmd, error: fetchErr } = await this.supabase
                        .from('robot_commands')
                        .select('command_id, robot_id, command_type, result, correlation_id, created_at')
                        .eq('command_id', cmdStub.command_id)
                        .single();
                        
                    if (!fetchErr && fullCmd) {
                        console.log(JSON.stringify({
                            event: 'COMMAND_POLLER_FOUND',
                            command_id: fullCmd.command_id,
                            correlation_id: fullCmd.correlation_id,
                            robot_id: fullCmd.robot_id,
                            barTimestamp: fullCmd.result?.barTimestamp || 'unknown'
                        }));
                        
                        if (fullCmd.command_type === 'TV_SIGNAL' && fullCmd.result?.barTimestamp) {
                            upsertSignalTrace({
                                robot_id: fullCmd.robot_id,
                                bar_timestamp: Number(fullCmd.result.barTimestamp),
                                poller_status: 'GREEN'
                            });
                        }

                        console.log(JSON.stringify({
                            event: 'COMMAND_POLLER_PROCESSING',
                            command_id: fullCmd.command_id,
                            correlation_id: fullCmd.correlation_id,
                            barTimestamp: fullCmd.result?.barTimestamp || 'unknown'
                        }));
                        
                        await this.processCommand(fullCmd);
                    }
                }
            }
        } catch (err) {
            console.error('[CommandPoller] Exception in poll:', err);
        }

        if (this.isPolling) {
            this.timer = setTimeout(() => this.poll(), 1000);
        }
    }

    private async processCommand(cmd: any) {
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

                console.log(JSON.stringify({
                    event: 'COMMAND_POLLER_DISPATCH',
                    command_id: cmd.command_id,
                    correlation_id: cmd.correlation_id,
                    barTimestamp: payload.barTimestamp || 'unknown'
                }));

                const result = await this.runtimeManager.adapter.handleWebhook(payload, cmd.robot_id, cmd.correlation_id);
                
                if (!result.accepted) {
                    await this.completeCommand(cmd.command_id, 'FAILED', { validationErrors: result.validationErrors });
                    return;
                }

                if (payload.isTest) {
                    console.log(`[WORKER] TEST_ID=${payload.testId}`);
                    await this.completeCommand(cmd.command_id, 'SUCCEEDED', { ...payload, execution: 'SKIPPED' });
                    return;
                }

                if (result.events) {
                    for (const ev of result.events) {
                        await coreEventBus.publish(ev.eventInstance);
                    }
                }

                // Wait for execution to finish
                await coreEventBus.waitForIdle(cmd.robot_id);
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
