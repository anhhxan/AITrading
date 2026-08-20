import { getSupabaseAdmin } from '@/lib/supabase';
import { RuntimeManager } from './RuntimeManager';
import { coreEventBus } from '@/core/infrastructure/EventBus';

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
                .select('*')
                .eq('status', 'RECEIVED')
                .order('created_at', { ascending: true })
                .limit(1);

            if (error) {
                console.error('[CommandPoller] Polling error:', error);
            } else if (commands && commands.length > 0) {
                const cmd = commands[0];
                
                // Optimistic lock: update to PROCESSING
                const { data: updated, error: lockErr } = await this.supabase
                    .from('robot_commands')
                    .update({ status: 'PROCESSING', processed_at: new Date().toISOString() })
                    .eq('command_id', cmd.command_id)
                    .eq('status', 'RECEIVED')
                    .select()
                    .single();

                if (!lockErr && updated) {
                    await this.processCommand(updated);
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
        console.log(`[CommandPoller] Processing command ${cmd.command_type} for robot ${cmd.robot_id}`);
        
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

                const result = await this.runtimeManager.adapter.handleWebhook(payload, cmd.robot_id);
                
                if (!result.accepted) {
                    await this.completeCommand(cmd.command_id, 'FAILED', { validationErrors: result.validationErrors });
                    return;
                }

                if (payload.isTest) {
                    console.log(`[WORKER] TEST_ID=${payload.testId}`);
                    await this.completeCommand(cmd.command_id, 'SUCCEEDED', { ...payload, execution: 'SKIPPED' });
                    return;
                }

                // Wait for execution to finish
                await coreEventBus.waitForIdle(cmd.robot_id);
                await this.completeCommand(cmd.command_id, 'SUCCEEDED', payload);
            }
            else {
                await this.completeCommand(cmd.command_id, 'FAILED', { error: 'Unknown command_type' });
            }
        } catch (err: any) {
            console.error(`[CommandPoller] Error processing command:`, err);
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
