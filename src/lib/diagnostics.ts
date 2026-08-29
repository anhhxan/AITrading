import { getSupabaseAdmin } from '@/lib/supabase';

export interface SignalTraceUpdate {
    robot_id: string;
    bar_timestamp: number;
    time_utc?: string;
    timeframe?: string;
    tv_symbol?: string;
    tv_ticker_id?: string;
    candle_trace_id?: string;
    correlation_id?: string;
    command_id?: string;
    request_id?: string;

    tv_status?: string;
    cf_status?: string;
    vercel_status?: string;
    db_status?: string;
    poller_status?: string;
    adapter_status?: string;
    strategy_status?: string;
    strategy_result?: string;
    error_reason?: string;
    diagnostics?: any;
}

export async function upsertSignalTrace(data: SignalTraceUpdate) {
    try {
        const supabase = getSupabaseAdmin();
        
        // Ensure required fields for upsert
        if (!data.candle_trace_id) {
            data.candle_trace_id = `1m_${data.bar_timestamp}`;
        }
        if (!data.time_utc) {
            data.time_utc = new Date(data.bar_timestamp).toISOString();
        }
        if (!data.timeframe) {
            data.timeframe = '1m'; // default fallback
        }

        const payload = {
            ...data,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('signal_trace_events')
            .upsert(payload, { 
                onConflict: 'robot_id, bar_timestamp',
                ignoreDuplicates: false 
            });

        if (error) {
            console.error(`[DIAGNOSTICS] Failed to upsert signal_trace_events for ${data.robot_id} @ ${data.bar_timestamp}:`, error.message);
        }
    } catch (e: any) {
        console.error(`[DIAGNOSTICS] Exception in upsertSignalTrace:`, e.message);
    }
}
