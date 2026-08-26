import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { upsertSignalTrace } from '@/lib/diagnostics';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.TV_WEBHOOK_SECRET;
    const authVal = authHeader ? authHeader.replace('Bearer ', '') : '';

    return NextResponse.json({
        envExists: !!expectedSecret,
        envLength: expectedSecret ? expectedSecret.length : 0,
        authReceived: !!authHeader,
        authLength: authVal.length,
        authMatchesEnv: expectedSecret && authVal === expectedSecret
    }, { status: 200 });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ robotId: string }> | { robotId: string } }) {
    const vercel_received_at = Date.now();
    const resolvedParams = await params;
    const robotId = resolvedParams.robotId;
    const request_id = req.headers.get('x-cf-request-id') || ('req_' + crypto.randomUUID().replace(/-/g, '').substring(0, 12));
    
    // Authentication
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.TV_WEBHOOK_SECRET;
    
    let payload;
    let rawPayloadStr = '';
    let barTimestamp = 'unknown';
    let timeframe = 'unknown';
    let tvSymbol = 'unknown';

    try {
        rawPayloadStr = await req.text();
        payload = JSON.parse(rawPayloadStr);

        if (payload.barTimestamp) {
            barTimestamp = String(payload.barTimestamp);
            const ts = Number(payload.barTimestamp);
            if (!Number.isFinite(ts)) throw new Error("INVALID_BAR_TIMESTAMP");
            payload.barTimestamp = ts;
        }
        if (payload.timeframe) timeframe = String(payload.timeframe);
        if (payload.tvSymbol || payload.symbol) tvSymbol = String(payload.tvSymbol || payload.symbol);
    } catch(e) {
        // Will reject below
    }

    console.log(JSON.stringify({
        event: 'VERCEL_RECEIVED',
        request_id,
        robot_id: robotId,
        barTimestamp,
        timeframe,
        tvSymbol,
        received_at: new Date(vercel_received_at).toISOString()
    }));
    
    // Best effort diagnostic: Initial Received (Also assumes CF received & forwarded if it has x-cf-request-id)
    if (barTimestamp !== 'unknown') {
        upsertSignalTrace({
            robot_id: robotId,
            bar_timestamp: Number(barTimestamp),
            timeframe,
            tv_symbol: tvSymbol,
            request_id,
            cf_status: req.headers.get('x-cf-request-id') ? 'GREEN' : 'UNKNOWN',
            vercel_status: 'GREEN'
        });
    }

    if (!expectedSecret) {
        return NextResponse.json({ error: 'SERVER_MISCONFIGURED' }, { status: 500 });
    }
    
    const authVal = authHeader ? authHeader.replace('Bearer ', '') : '';
    const auth_valid = authVal === expectedSecret;
    
    console.log(JSON.stringify({
        event: 'VERCEL_AUTH_RESULT',
        request_id,
        auth_valid
    }));

    if (!auth_valid) {
        if (barTimestamp !== 'unknown') upsertSignalTrace({ robot_id: robotId, bar_timestamp: Number(barTimestamp), vercel_status: 'RED' });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!payload) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    console.log(JSON.stringify({
        event: 'VERCEL_TIMESTAMP_CHECK',
        request_id,
        barTimestamp,
        valid: typeof payload.barTimestamp === 'number'
    }));

    const supabase = getSupabaseAdmin();

    // Verify robot exists and is RUNNING
    const { data: robot, error: robotError } = await supabase
        .from('robots')
        .select('id, status, trading_mode, trading_account_id')
        .eq('id', robotId)
        .single();
        
    console.log(JSON.stringify({
        event: 'VERCEL_ROBOT_CHECK',
        request_id,
        robot_id: robotId,
        robot_exists: !!robot && !robotError,
        robot_status: robot?.status || 'UNKNOWN',
        trading_enabled: true // Always true for now unless we need to check another field
    }));

    if (robotError || !robot) {
        return NextResponse.json({ error: 'ROBOT_NOT_FOUND' }, { status: 404 });
    }

    if (robot.status !== 'RUNNING') {
        return NextResponse.json({ error: 'ROBOT_NOT_RUNNING' }, { status: 400 });
    }

    if (robot.trading_mode === 'LIVE' && !robot.trading_account_id) {
        return NextResponse.json({ error: 'LIVE_MODE_REQUIRES_TRADING_ACCOUNT' }, { status: 400 });
    }

    // Deterministic Idempotency Check
    // NEW SIGNAL IDENTITY RULE: robot_id + barTimestamp + direction
    const payloadStr = JSON.stringify(payload);
    let identityString = payloadStr;
    if (payload.direction && payload.barTimestamp) {
        identityString = `${robotId}_${payload.barTimestamp}_${payload.direction}`;
    }
    
    const hash = crypto.createHash('md5').update(identityString).digest('hex');
    const deterministicCommandId = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
    const hash_prefix = hash.slice(0, 10);
    const correlation_id = `tv_${hash_prefix}_${Date.now()}`;

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

    if (cmdError && cmdError.code === '23505') {
        return NextResponse.json({ status: 'OK', message: 'Duplicate acknowledged' }, { status: 200 });
    }

    if (cmdError) {
        console.log(JSON.stringify({
            event: 'VERCEL_DB_ERROR',
            request_id,
            safe_error_code: cmdError.code || 'UNKNOWN',
            safe_error_message: cmdError.message || 'Unknown database error'
        }));
        
        upsertSignalTrace({ 
            robot_id: robotId, 
            bar_timestamp: Number(barTimestamp), 
            db_status: 'RED',
            command_id: deterministicCommandId,
            correlation_id
        });

        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    console.log(JSON.stringify({
        event: 'VERCEL_DB_INSERT',
        request_id,
        command_id: deterministicCommandId,
        correlation_id,
        barTimestamp,
        db_insert_success: true
    }));

    upsertSignalTrace({ 
        robot_id: robotId, 
        bar_timestamp: Number(barTimestamp), 
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
