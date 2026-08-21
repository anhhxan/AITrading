import { RuntimeManager } from './RuntimeManager';
import { CommandPoller } from './CommandPoller';
import { getSupabaseAdmin } from '@/lib/supabase';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function bootstrap() {
    const workerId = process.env.WORKER_ID || 'PAPER-WORKER-01';
    const envStr = process.env.NODE_ENV || 'development';

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('[Worker] FATAL: Missing Supabase environment variables.');
        process.exit(1);
    }

    try {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from('robots').select('id').limit(1);
        if (error) throw error;
    } catch (dbErr: any) {
        console.error('[Worker] FATAL: Database connection failed.', dbErr.message);
        process.exit(1);
    }

    console.log('[Worker] =================================');
    console.log('[Worker] PAPER WORKER STARTING');
    console.log(`[Worker] worker_id=${workerId}`);
    console.log(`[Worker] environment=${envStr}`);
    console.log('[Worker] database=CONNECTED');

    const runtimeManager = new RuntimeManager();
    await runtimeManager.initializeEngines();
    
    console.log('[Recovery] Loading RUNNING robots...');
    try {
        const supabase = getSupabaseAdmin();
        const { data: runningRobots, error: recErr } = await supabase
            .from('robots')
            .select('id')
            .eq('status', 'RUNNING');
            
        if (recErr) {
            console.error('[Recovery] Failed to load running robots:', recErr);
        } else if (runningRobots) {
            console.log(`[Recovery] Found ${runningRobots.length} RUNNING robots`);
            let registered = 0;
            for (const r of runningRobots) {
                try {
                    await runtimeManager.getOrCreateRuntime(r.id);
                    console.log(`[Recovery] REGISTER robot=${r.id}`);
                    registered++;
                } catch (e: any) {
                    // Ignore MISSING_CONFIG gracefully to continue recovering others
                    console.error(`[Recovery] Failed to register robot=${r.id}`, e.message);
                }
            }
            console.log(`[Recovery] COMPLETE registered=${registered}`);
        }
    } catch (err) {
        console.error('[Recovery] Unexpected error during recovery:', err);
    }

    const poller = new CommandPoller(runtimeManager);
    poller.start();
    console.log('[Worker] command_poller=STARTED');
    console.log('[Worker] heartbeat=STARTED'); 
    console.log('[Worker] READY');
    console.log('[Worker] =================================');

    // Heartbeat logic
    setInterval(() => {
        runtimeManager.heartbeatAll().catch(e => console.error('[Heartbeat] Error:', e));
    }, 10000);

    process.on('SIGINT', () => {
        console.log('[Worker] Shutting down...');
        poller.stop();
        process.exit(0);
    });
}

bootstrap().catch(err => {
    console.error('[Worker] Fatal error:', err);
    process.exit(1);
});
