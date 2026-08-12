import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ robotId: string }> | { robotId: string } }) {
    const receivedAt = new Date().toISOString();
    
    // Resolve params for Next.js 15+ compatibility
    const resolvedParams = await params;
    const robotId = resolvedParams.robotId;
    
    // Authentication (Bearer Token)
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.TV_WEBHOOK_SECRET;
    if (!authHeader || !expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    let payload;
    let rawPayloadStr = '';
    try {
        rawPayloadStr = await req.text();
        payload = JSON.parse(rawPayloadStr);
    } catch(e) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdmin();

    // Verify robot exists and is RUNNING
    const { data: robot, error: robotError } = await supabase
        .from('robots')
        .select('id, status, trading_enabled, execution_symbol')
        .eq('id', robotId)
        .single();
        
    if (robotError || !robot) {
        return NextResponse.json({ error: 'ROBOT_NOT_FOUND' }, { status: 404 });
    }

    if (robot.status !== 'RUNNING') {
        // We accept the signal but log it as ignored, or just reject
        return NextResponse.json({ error: 'ROBOT_NOT_RUNNING' }, { status: 400 });
    }

    // Deterministic payload hash to prevent duplicate commands
    const payloadStr = JSON.stringify(payload);
    const hash = crypto.createHash('md5').update(payloadStr).digest('hex');
    const deterministicCommandId = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;

    // Insert into robot_commands
    const { error: cmdError } = await supabase.from('robot_commands').insert({
        robot_id: robot.id,
        command_id: deterministicCommandId,
        command_type: 'TV_SIGNAL',
        status: 'RECEIVED',
        correlation_id: `tv_${hash.slice(0, 10)}_${Date.now()}`,
        result: payload // store payload in result temporarily until processed
    });

    if (cmdError) {
        if (cmdError.code === '23505') {
            console.log(`[TV WEBHOOK] Idempotent drop: duplicate command_id ${deterministicCommandId}`);
            return NextResponse.json({ status: 'OK', message: 'Duplicate acknowledged' }, { status: 200 });
        }
        console.error('[TV WEBHOOK] Supabase Insert Error:', cmdError);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    return NextResponse.json({ status: 'OK', command_id: deterministicCommandId }, { status: 200 });
}

