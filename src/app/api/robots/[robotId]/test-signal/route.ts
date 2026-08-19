import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ robotId: string }> | { robotId: string } }) {
    const resolvedParams = await params;
    const robotId = resolvedParams.robotId;
    
    const supabase = getSupabaseAdmin();
    const { data: robot, error: robotError } = await supabase.from('robots').select('id, status').eq('id', robotId).single();
    if (robotError || !robot) {
        return NextResponse.json({ error: 'ROBOT_NOT_FOUND' }, { status: 404 });
    }

    const testId = crypto.randomUUID();
    const proxyBaseUrl = process.env.TV_WEBHOOK_PROXY_URL || 'https://tv-webhook-proxy.tradingbn.workers.dev/api/webhook/tv';
    const secret = process.env.TV_WEBHOOK_SECRET || '';
    const targetUrl = `${proxyBaseUrl}/${robotId}`;

    const payload = {
        isTest: true,
        testId: testId,
        event_type: 'TEST_SIGNAL',
        timestamp: Date.now(),
        // Add fake OHLC to bypass any strict parsers in worker if needed
        tvSymbol: "BTCUSDT",
        barTimestamp: Date.now(),
        open: 64000, high: 64000, low: 64000, close: 64000, volume: 1
    };

    const startTime = Date.now();
    let cfStatus = 500;
    let cfResponseText = '';
    let cfError = '';

    try {
        console.log(`[TEST SIGNAL] Sending to ${targetUrl}`);
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${secret}`
            },
            body: JSON.stringify(payload)
        });
        
        cfStatus = response.status;
        cfResponseText = await response.text();
    } catch (err: any) {
        cfError = err.message;
        console.error(`[TEST SIGNAL] CF Fetch Error:`, err);
    }
    
    const duration = Date.now() - startTime;
    
    // Wait and verify if it reached Supabase
    let persistenceResult = 'NOT_FOUND';
    let executionStatus = 'UNKNOWN';
    let retries = 0;
    
    while (retries < 4) {
        await new Promise(r => setTimeout(r, 1000));
        
        const { data: events, error } = await supabase
            .from('core_events')
            .select('payload')
            .eq('robot_id', robotId)
            .eq('event_type', 'TEST_SIGNAL')
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (!error && events && events.length > 0) {
            const match = events.find((e: any) => e.payload && e.payload.testId === testId);
            if (match) {
                persistenceResult = 'SUCCESS';
                executionStatus = match.payload.execution_status || 'SKIPPED';
                break;
            }
        }
        retries++;
    }

    return NextResponse.json({
        testId,
        targetUrl,
        worker_request_status: cfError ? 'FAILED' : 'SENT',
        worker_response_status: cfStatus,
        worker_response_text: cfResponseText.substring(0, 200),
        duration_ms: duration,
        supabase_persistence: persistenceResult,
        execution_status: executionStatus,
        error: cfError || null
    });
}
