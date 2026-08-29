import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { upsertSignalTrace } from '@/lib/diagnostics';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
    const expectedSecret = process.env.TV_WEBHOOK_SECRET;
    const url = new URL(req.url);
    const providedSecret = url.searchParams.get('secret');

    return NextResponse.json({
        envExists: !!expectedSecret,
        envLength: expectedSecret ? expectedSecret.length : 0,
        authReceived: !!providedSecret,
        authMatchesEnv: expectedSecret && providedSecret === expectedSecret
    }, { status: 200 });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ robotId: string }> | { robotId: string } }) {
    const vercel_received_at = Date.now();
    const resolvedParams = await params;
    const robotId = resolvedParams.robotId;
    const request_id = req.headers.get('x-cf-request-id') || ('req_' + crypto.randomUUID().replace(/-/g, '').substring(0, 12));
    
    // Authentication via Payload Secret
    const expectedSecret = process.env.TV_WEBHOOK_SECRET;
    
    let payload;
    let rawPayloadStr = '';
    let eventTimestamp = 'unknown';
    let setupId = 'unknown';
    let tvEvent = 'unknown';

    try {
        rawPayloadStr = await req.text();
        payload = JSON.parse(rawPayloadStr);

        if (payload.eventTimestamp) {
            eventTimestamp = String(payload.eventTimestamp);
            const ts = Number(payload.eventTimestamp);
            if (!Number.isFinite(ts)) throw new Error("INVALID_EVENT_TIMESTAMP");
            payload.eventTimestamp = ts;
        }
        if (payload.setup_id) setupId = String(payload.setup_id);
        if (payload.event) tvEvent = String(payload.event);
    } catch(e) {
        // Will reject below
    }

    console.log(JSON.stringify({
        event: 'VERCEL_RECEIVED',
        request_id,
        robot_id: robotId,
        eventTimestamp,
        setupId,
        tvEvent,
        received_at: new Date(vercel_received_at).toISOString()
    }));
    
    // Best effort diagnostic: Initial Received
    if (eventTimestamp !== 'unknown') {
        upsertSignalTrace({
            robot_id: robotId,
            bar_timestamp: Number(eventTimestamp), // mapped to bar_timestamp for legacy diagnostics
            timeframe: 'unknown',
            tv_symbol: 'unknown',
            request_id,
            cf_status: req.headers.get('x-cf-request-id') ? 'GREEN' : 'UNKNOWN',
            vercel_status: 'GREEN'
        });
    }

    if (!expectedSecret) {
        return NextResponse.json({ error: 'SERVER_MISCONFIGURED' }, { status: 500 });
    }

    if (!payload) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    const auth_valid = payload.secret === expectedSecret;
    
    // Remove secret from payload so it doesn't get logged or stored in DB
    if (payload.secret) {
        delete payload.secret;
    }
    
    // Re-stringify the payload after deleting secret to keep identity string safe
    const payloadStr = JSON.stringify(payload);

    console.log(JSON.stringify({
        event: 'VERCEL_AUTH_RESULT',
        request_id,
        auth_valid
    }));

    if (!auth_valid) {
        if (eventTimestamp !== 'unknown') upsertSignalTrace({ robot_id: robotId, bar_timestamp: Number(eventTimestamp), vercel_status: 'RED' });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log(JSON.stringify({
        event: 'VERCEL_PAYLOAD_VALIDATION',
        request_id,
        eventTimestamp,
        valid: typeof payload.eventTimestamp === 'number' && typeof payload.setup_id === 'string'
    }));

    // Ensure robot exists and has ACTIVE config, and fetch current state (IDLE, RUNNING, etc)
    const supabase = getSupabaseAdmin();
    const { data: robot, error: robotError } = await supabase
        .from('robots')
        .select('id, current_state')
        .eq('id', robotId)
        .eq('is_archived', false)
        .single();

    if (robotError || !robot) {
        if (eventTimestamp !== 'unknown') upsertSignalTrace({ 
            robot_id: robotId, 
            bar_timestamp: Number(eventTimestamp), 
            db_status: 'RED',
            error_reason: 'ROBOT_NOT_FOUND'
        });
        return NextResponse.json({ error: 'Robot not found' }, { status: 404 });
    }

    // NEW SIGNAL IDENTITY RULE: robot_id + setup_id + event
    let identityString = payloadStr;
    if (payload.setup_id && payload.event) {
        identityString = `${robotId}_${payload.setup_id}_${payload.event}`;
    }
    
    const hash = crypto.createHash('md5').update(identityString).digest('hex');
    const deterministicCommandId = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
    
    // Idempotency: NO Date.now(). Must be deterministic.
    const correlation_id = `tv_${hash.slice(0, 16)}`;

    // Ensure backwards compatibility with old logging for now
    let hash_prefix = hash.slice(0, 10);

    // Insert command as PENDING so Worker can pick it up
    const { error: cmdError } = await supabase.from('robot_commands').insert({
        robot_id: robot.id,
        command_id: deterministicCommandId,
        command_type: 'TV_SIGNAL',
        status: 'RECEIVED',
        correlation_id: correlation_id,
        result: payload 
    });

    console.log(JSON.stringify({
        event: 'VERCEL_IDEMPOTENCY_CHECK',
        request_id,
        hash_prefix,
        duplicate: cmdError && cmdError.code === '23505'
    }));

    if (cmdError) {
        if (cmdError.code === '23505') {
            return NextResponse.json({ message: 'Duplicate signal ignored' }, { status: 200 });
        }
        
        console.error('Failed to insert command:', cmdError);
        
        if (eventTimestamp !== 'unknown') upsertSignalTrace({ 
            robot_id: robotId, 
            bar_timestamp: Number(eventTimestamp), 
            db_status: 'RED',
            command_id: deterministicCommandId,
            correlation_id
        });

        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    if (eventTimestamp !== 'unknown') upsertSignalTrace({ 
        robot_id: robotId, 
        bar_timestamp: Number(eventTimestamp), 
        db_status: 'GREEN',
        command_id: deterministicCommandId,
        correlation_id
    });

    if (payload.isTest) {
        const { error: eventErr } = await supabase.from('core_events').insert({
            robot_id: robotId,
            event_id: crypto.randomUUID(),
            event_type: 'TEST_SIGNAL',
            correlation_id: payload.testId,
            event_sequence: Date.now(),
            timestamp: Date.now(),
            payload: {
                testId: payload.testId,
                execution_status: 'SKIPPED',
                received_at: new Date().toISOString()
            }
        });
    }

    return NextResponse.json({ status: 'OK', message: 'Accepted for processing' }, { status: 200 });
}
