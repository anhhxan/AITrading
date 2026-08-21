import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
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
    
    // Authentication
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.TV_WEBHOOK_SECRET;
    
    if (!expectedSecret) {
        return NextResponse.json({ error: 'SERVER_MISCONFIGURED' }, { status: 500 });
    }
    
    const authVal = authHeader ? authHeader.replace('Bearer ', '') : '';
    if (authVal !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    let payload;
    try {
        const rawPayloadStr = await req.text();
        payload = JSON.parse(rawPayloadStr);

        if (payload.barTimestamp) {
            const ts = Number(payload.barTimestamp);
            if (!Number.isFinite(ts)) throw new Error("INVALID_BAR_TIMESTAMP");
            payload.barTimestamp = ts;
        }
    } catch(e) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdmin();

    // Verify robot exists and is RUNNING
    const { data: robot, error: robotError } = await supabase
        .from('robots')
        .select('id, status, trading_mode, trading_account_id')
        .eq('id', robotId)
        .single();
        
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
    const payloadStr = JSON.stringify(payload);
    const hash = crypto.createHash('md5').update(payloadStr).digest('hex');
    const deterministicCommandId = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;

    // Insert command as PENDING so Worker can pick it up
    const { error: cmdError } = await supabase.from('robot_commands').insert({
        robot_id: robot.id,
        command_id: deterministicCommandId,
        command_type: 'TV_SIGNAL',
        status: 'RECEIVED',
        correlation_id: `tv_${hash.slice(0, 10)}_${Date.now()}`,
        result: payload 
    });

    if (cmdError && cmdError.code === '23505') {
        console.log(`[TV WEBHOOK] Idempotent drop: duplicate command_id ${deterministicCommandId}`);
        return NextResponse.json({ status: 'OK', message: 'Duplicate acknowledged' }, { status: 200 });
    }

    if (cmdError) {
        console.error('[TV WEBHOOK] Failed to insert command:', cmdError.message);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    if (payload.isTest) {
        console.log(`[WEBHOOK] TEST_ID=${payload.testId}`);
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
        if (eventErr) {
            console.error(`[WEBHOOK] Failed to insert core_events TEST_ID=${payload.testId}`, eventErr);
        }
    } else {
        console.log(`[WEBHOOK] REAL_SIGNAL`);
        console.log(`[WEBHOOK] robot_id=${robotId}`);
        console.log(`[WEBHOOK] symbol=${payload.tvSymbol || payload.symbol || 'UNKNOWN'}`);
        console.log(`[WEBHOOK] side=${payload.action || payload.side || 'UNKNOWN'}`);
        console.log(`[WEBHOOK] mode=${robot.trading_mode}`);
    }

    const vercel_response_at = Date.now();
    console.log(`[VERCEL WEBHOOK] Received and Queued robot ${robotId}. Latency: ${vercel_response_at - vercel_received_at}ms`);

    return NextResponse.json({ status: 'OK', message: 'Accepted for processing' }, { status: 200 });
}
