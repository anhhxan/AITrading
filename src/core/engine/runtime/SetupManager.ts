import { getSupabaseAdmin } from '../../../lib/supabase';
import { EventFactory } from '../../infrastructure/EventFactory';
import crypto from 'crypto';

export interface SetupPayload {
    setup_id: string;
    event: 'PENDING' | 'ARM' | 'FIRE' | 'CANCEL' | 'STOP';
    direction?: 'LONG' | 'SHORT';
    trigger?: number;
    stop?: number;
    eventTimestamp: number;
    snapshot?: any;
}

export class SetupManager {
    /**
     * Processes a setup event and maintains the active_setups table.
     * Ensures atomic updates and strict ordering via setup_id + event lifecycle.
     */
    public static async handleSetupEvent(robotId: string, payload: SetupPayload): Promise<{ success: boolean; error?: string }> {
        const supabase = getSupabaseAdmin();
        const { setup_id, event, trigger, stop, direction, eventTimestamp, snapshot } = payload;

        try {
            // 1. Fetch current setup state (if any)
            const { data: currentSetup, error: fetchErr } = await supabase
                .from('active_setups')
                .select('*')
                .eq('robot_id', robotId)
                .eq('setup_id', setup_id)
                .single();

            if (fetchErr && fetchErr.code !== 'PGRST116') {
                console.error('[SetupManager] Error fetching setup:', fetchErr);
                return { success: false, error: 'DB_ERROR' };
            }

            // 2. Strict State Machine Transitions
            if (event === 'PENDING') {
                if (currentSetup) return { success: true }; // Idempotent duplicate
                if (!direction) return { success: false, error: 'MISSING_DIRECTION' };
                
                const { error: insertErr } = await supabase.from('active_setups').insert({
                    robot_id: robotId, setup_id, state: 'PENDING', direction, trigger_price: trigger, stop_price: stop, snapshot
                });
                if (insertErr && insertErr.code !== '23505') return { success: false, error: 'INSERT_FAILED' };
            } 
            else if (event === 'ARM') {
                if (!currentSetup) {
                    // Allowed: Pine might skip PENDING and send ARM directly.
                    if (!direction) return { success: false, error: 'MISSING_DIRECTION_FOR_ARM' };
                    const { error: insertErr } = await supabase.from('active_setups').insert({
                        robot_id: robotId, setup_id, state: 'ARM', direction, trigger_price: trigger, stop_price: stop, snapshot
                    });
                    if (insertErr && insertErr.code !== '23505') return { success: false, error: 'INSERT_FAILED' };
                } else {
                    if (currentSetup.state === 'ARM') return { success: true }; // Idempotent duplicate
                    if (currentSetup.state !== 'PENDING') {
                        console.warn(`[SetupManager] INVALID TRANSITION: Cannot ARM from ${currentSetup.state} for ${setup_id}`);
                        return { success: false, error: 'INVALID_TRANSITION' };
                    }
                    await supabase.from('active_setups')
                        .update({ state: 'ARM', trigger_price: trigger, stop_price: stop, snapshot })
                        .eq('robot_id', robotId)
                        .eq('setup_id', setup_id);
                }
            }
            else if (event === 'FIRE') {
                if (!currentSetup) {
                    console.error(`[SetupManager] SEQUENCING ERROR: FIRE received without ARM/PENDING for setup ${setup_id}. Execution aborted.`);
                    return { success: false, error: 'SEQUENCING_ERROR_NO_ARM' };
                }
                if (currentSetup.state === 'ACTIVE') return { success: true }; // Idempotent duplicate
                if (currentSetup.state !== 'ARM') {
                    console.warn(`[SetupManager] INVALID TRANSITION: Cannot FIRE from ${currentSetup.state} for ${setup_id}`);
                    return { success: false, error: 'INVALID_TRANSITION' };
                }
                await supabase.from('active_setups')
                    .update({ state: 'ACTIVE', trigger_price: trigger, stop_price: stop, snapshot })
                    .eq('robot_id', robotId)
                    .eq('setup_id', setup_id);
            }
            else if (event === 'CANCEL') {
                if (!currentSetup) return { success: true }; // Idempotent
                if (currentSetup.state !== 'PENDING' && currentSetup.state !== 'ARM') {
                    console.warn(`[SetupManager] INVALID TRANSITION: Cannot CANCEL from ${currentSetup.state} for ${setup_id}`);
                    return { success: false, error: 'INVALID_TRANSITION' };
                }
                await supabase.from('active_setups').delete().eq('robot_id', robotId).eq('setup_id', setup_id);
            }
            else if (event === 'STOP') {
                if (!currentSetup) return { success: true }; // Idempotent
                if (currentSetup.state !== 'ACTIVE') {
                    console.warn(`[SetupManager] INVALID TRANSITION: Cannot STOP from ${currentSetup.state} for ${setup_id}`);
                    return { success: false, error: 'INVALID_TRANSITION' };
                }
                await supabase.from('active_setups').delete().eq('robot_id', robotId).eq('setup_id', setup_id);
            }
            
            return { success: true };
            
        } catch (err: any) {
            console.error('[SetupManager] Exception:', err);
            return { success: false, error: err.message };
        }
    }
}
