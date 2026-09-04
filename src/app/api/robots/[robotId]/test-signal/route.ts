import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ robotId: string }> | { robotId: string } }) {
    const resolvedParams = await params;
    const robotId = resolvedParams.robotId;
    
    const supabase = getSupabaseAdmin();
    const { data: robot, error: robotError } = await supabase.from('robots').select('id, status, trading_view_symbol, timeframe').eq('id', robotId).single();
    if (robotError || !robot) {
        return NextResponse.json({ error: 'ROBOT_NOT_FOUND' }, { status: 404 });
    }

    if (robot.status !== 'RUNNING') {
        return NextResponse.json({ error: 'ROBOT_NOT_RUNNING', details: `Status is ${robot.status}` }, { status: 400 });
    }

    if (!robot.trading_view_symbol || !robot.timeframe) {
        return NextResponse.json({ error: 'MISSING_ROBOT_CONFIG', details: 'Robot is missing trading_view_symbol or timeframe' }, { status: 400 });
    }

    const testId = crypto.randomUUID();
    console.log(`[BFF] TEST_ID=${testId}`);
    const proxyBaseUrl = process.env.CLOUDFLARE_PROXY_URL || 'https://tv-webhook-proxy.tradingbn.workers.dev';
    const proxyToken = process.env.CLOUDFLARE_PROXY_TOKEN || '';
    const targetUrl = `${proxyBaseUrl}/tv/${robotId}/${proxyToken}`;
    
    const secret = process.env.TV_WEBHOOK_SECRET || '';

    const payload = {
        isTest: true,
        isE2E: true,
        testId: testId,
        tvSymbol: robot.trading_view_symbol,
        tvTickerId: robot.trading_view_symbol,
        timeframe: robot.timeframe,
        barTimestamp: Date.now(),
        open: 100, high: 106, low: 90, close: 105, volume: 1,
        indicator: {
            length: 20,
            source: "close",
            mult: 2,
            mult2: 3
        },
        plots: {
            B1: 130,
            B2: 120,
            B3: 110,
            B4: 100,
            B5: 90
        },
        secret: secret
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
    
    let persistenceResult = 'NOT_FOUND';
    let executionStatus = 'UNKNOWN';
    let retries = 0;
    let computedCorrelationId = testId;
    
    while (retries < 10) {
        await new Promise(r => setTimeout(r, 1000));
        
        if (computedCorrelationId === testId) {
            const { data: cmd } = await supabase
                .from('robot_commands')
                .select('correlation_id')
                .eq('command_type', 'TV_SIGNAL')
                .contains('result', { testId: testId })
                .single();
            if (cmd && cmd.correlation_id) {
                computedCorrelationId = cmd.correlation_id;
            }
        }
        
        const { data: events, error } = await supabase
            .from('core_events')
            .select('event_type, payload')
            .eq('robot_id', robotId)
            .in('correlation_id', [testId, computedCorrelationId])
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (!error && events && events.length > 0) {
            persistenceResult = 'SUCCESS';
            
            const eventTypes = events.map(e => e.event_type);
            
            if (eventTypes.includes('POSITION_OPENED_EVENT')) {
                executionStatus = 'SUCCESS (Vo lenh)';
                break;
            } else if (eventTypes.includes('ORDER_REJECTED_EVENT') || eventTypes.includes('EXECUTION_ERROR_EVENT')) {
                executionStatus = 'FAILED (Loi lenh)';
                break;
            } else if (eventTypes.includes('RISK_REJECTED_EVENT')) {
                executionStatus = 'RISK_REJECTED';
                break;
            } else if (eventTypes.includes('ORDER_CANCELLED_EVENT')) {
                executionStatus = 'CANCELLED';
                break;
            } else if (eventTypes.includes('TRADE_PLAN_EVENT')) {
                executionStatus = 'TRADE_PLAN (Da duyet)';
                break;
            } else if (eventTypes.includes('STATE_TRANSITION_EVENT')) {
                executionStatus = 'READY_TO_ENTER';
            } else if (eventTypes.includes('STRATEGY_SIGNAL_EVENT')) {
                executionStatus = 'STRATEGY_PASS';
            } else if (eventTypes.includes('REALTIME_PRICE_EVENT')) {
                executionStatus = 'PROCESSING_TICKS';
            } else {
                executionStatus = 'RECEIVED';
            }
        }
        retries++;
    }

    const safeTargetUrl = `${proxyBaseUrl}/tv/${robotId}/[HIDDEN_TOKEN]`;

    return NextResponse.json({
        testId,
        targetUrl: safeTargetUrl,
        worker_request_status: cfError ? 'FAILED' : 'SENT',
        worker_response_status: cfStatus,
        worker_response_text: cfResponseText.substring(0, 200),
        duration_ms: duration,
        supabase_persistence: persistenceResult,
        execution_status: executionStatus,
        error: cfError || null
    });
}