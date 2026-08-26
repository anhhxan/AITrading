'use client'

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity } from 'lucide-react';

export default function SignalPipelineMonitor({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const robotId = resolvedParams.id;
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [robotStatus, setRobotStatus] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    // Realtime Price Feed States
    const [feedHeartbeat, setFeedHeartbeat] = useState<any>(null);
    const [waitRetracementSignal, setWaitRetracementSignal] = useState<any>(null);

    // Golden Trace States
    const [goldenTraces, setGoldenTraces] = useState<any[]>([]);

    useEffect(() => {
        if (!robotId || robotId === '') return;

        async function fetchData() {
            setLoading(true);
            try {
                // Fetch Robot Status
                const { data: robot } = await supabase.from('robots').select('*').eq('id', robotId).single();
                setRobotStatus(robot);

                // Fetch Heartbeat
                const { data: heartbeats } = await supabase.from('core_events')
                    .select('*').eq('robot_id', robotId).eq('event_type', 'PRICE_HEARTBEAT_EVENT')
                    .order('timestamp', { ascending: false }).limit(1);
                
                if (heartbeats && heartbeats.length > 0) setFeedHeartbeat(heartbeats[0].payload);

                // Fetch Wait Retracement signal info if needed
                if (robot?.current_state === 'WAIT_RETRACEMENT') {
                    const { data: signals } = await supabase.from('core_events')
                        .select('payload').eq('robot_id', robotId).eq('event_type', 'STRATEGY_SIGNAL_EVENT')
                        .order('timestamp', { ascending: false }).limit(1);
                    if (signals && signals.length > 0) setWaitRetracementSignal(signals[0].payload);
                }

                // Fetch Golden Traces (Latest 10 Signals)
                const { data: latestSignals } = await supabase.from('core_events')
                    .select('*').eq('robot_id', robotId).eq('event_type', 'STRATEGY_SIGNAL_EVENT')
                    .order('timestamp', { ascending: false }).limit(10);

                if (latestSignals && latestSignals.length > 0) {
                    const correlationIds = latestSignals.map(s => s.payload?.trace?.correlationId).filter(Boolean);
                    
                    const { data: relatedEvents } = await supabase.from('core_events')
                        .select('*').eq('robot_id', robotId)
                        .in('event_type', [
                            'STRATEGY_SIGNAL_EVENT', 'REALTIME_PRICE_EVENT', 'RETRACEMENT_ZONE_TOUCHED', 
                            'RETRACEMENT_ENTRY_TRIGGERED', 'STATE_TRANSITION_EVENT', 'TRADE_PLAN_EVENT', 
                            'POSITION_OPENED_EVENT'
                        ])
                        .in('payload->trace->>correlationId', correlationIds)
                        .order('event_sequence', { ascending: true }); // Use sequence for proper causal ordering

                    // Group by correlation_id
                    const tracesMap = new Map();
                    latestSignals.forEach(sig => {
                        tracesMap.set(sig.payload?.trace?.correlationId, { signal: sig, events: [] });
                    });

                    if (relatedEvents) {
                        relatedEvents.forEach(evt => {
                            const cid = evt.payload?.trace?.correlationId;
                            if (tracesMap.has(cid)) {
                                tracesMap.get(cid).events.push(evt);
                            }
                        });
                    }

                    // Also fetch any events where correlationId was injected by RiskEngine inside trace
                    const { data: relatedEvents2 } = await supabase.from('core_events')
                        .select('*').eq('robot_id', robotId)
                        .in('event_type', ['TRADE_PLAN_EVENT', 'POSITION_OPENED_EVENT', 'RETRACEMENT_ENTRY_TRIGGERED', 'STATE_TRANSITION_EVENT', 'RETRACEMENT_ZONE_TOUCHED'])
                        .order('event_sequence', { ascending: true });
                        
                    if (relatedEvents2) {
                         relatedEvents2.forEach(evt => {
                            const cid = evt.payload?.trace?.correlationId;
                            if (tracesMap.has(cid)) {
                                // check if not already added
                                if (!tracesMap.get(cid).events.some((e:any) => e.id === evt.id)) {
                                    tracesMap.get(cid).events.push(evt);
                                }
                            }
                        });
                    }

                    setGoldenTraces(Array.from(tracesMap.values()));
                }

            } catch (err: any) {
                console.error("[PIPELINE_MONITOR] Unexpected error", err);
                setErrorMsg(err.message);
            }
            setLoading(false);
        }
        
        fetchData();
        
        const subCore = supabase.channel('core_events_ch')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'core_events', filter: `robot_id=eq.${robotId}` }, () => {
                fetchData();
            })
            .subscribe();

        return () => { subCore.unsubscribe(); }
    }, [robotId, supabase]);

    return (
        <div className="w-full mx-auto space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">PAPER 1M - SIGNAL MONITOR</h1>
                        <p className="text-muted-foreground">E2E Observability for Phase 3 Signal Pipeline</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* FEED HEARTBEAT */}
                    <Card className="border-indigo-100">
                        <CardHeader className="bg-indigo-50/50 py-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-semibold text-indigo-800">REALTIME PRICE FEED</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            {feedHeartbeat ? (
                                <>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <span className="text-slate-500">Symbol</span>
                                        <span className="font-mono font-medium">{feedHeartbeat.symbol}</span>
                                        
                                        <span className="text-slate-500">Last Price</span>
                                        <span className="font-mono font-bold text-lg">{feedHeartbeat.price?.toFixed(2)}</span>
                                        
                                        <span className="text-slate-500">Market Time (UTC)</span>
                                        <span className="font-mono text-xs">
                                            {new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }).format(new Date(feedHeartbeat.eventTimestamp))}
                                        </span>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                                        <div className={`h-3 w-3 rounded-full ${feedHeartbeat.status === 'CONNECTED' ? 'bg-green-500' : feedHeartbeat.status === 'STALE' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                        <span className={`font-bold ${feedHeartbeat.status === 'CONNECTED' ? 'text-green-700' : feedHeartbeat.status === 'STALE' ? 'text-yellow-700' : 'text-red-700'}`}>
                                            {feedHeartbeat.status}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-slate-500 text-sm">Waiting for connection...</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* RETRACEMENT MONITOR */}
                    {robotStatus?.current_state === 'WAIT_RETRACEMENT' && waitRetracementSignal && (
                        <Card className="border-amber-200">
                            <CardHeader className="bg-amber-50/50 py-3 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-semibold text-amber-800">RETRACEMENT MONITOR</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <span className="text-slate-500">Direction</span>
                                    <span className={`font-bold ${waitRetracementSignal.direction === 'LONG' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {waitRetracementSignal.direction}
                                    </span>
                                    
                                    <span className="text-slate-500">Zone</span>
                                    <span className="font-mono text-amber-700 font-medium">
                                        {waitRetracementSignal.entryTrigger?.lower?.toFixed(2)} - {waitRetracementSignal.entryTrigger?.upper?.toFixed(2)}
                                    </span>
                                    
                                    <span className="text-slate-500">Current Price</span>
                                    <span className="font-mono font-bold">{feedHeartbeat?.price?.toFixed(2) || 'N/A'}</span>
                                    
                                    <span className="text-slate-500">Status</span>
                                    <span className="font-bold text-amber-600">WAITING FOR RETRACEMENT</span>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* GOLDEN TRACE MONITOR */}
                <div className="mt-8">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-600" />
                        Golden Trace Monitor
                    </h2>
                    
                    {goldenTraces.length === 0 && !loading && (
                        <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                            No signals found in Golden Trace format.
                        </div>
                    )}

                    <div className="space-y-6">
                        {goldenTraces.map((traceGroup, i) => {
                            const events = traceGroup.events || [];
                            const hasPositionOpened = events.some((e:any) => e.event_type === 'POSITION_OPENED_EVENT');
                            const hasTradePlan = events.some((e:any) => e.event_type === 'TRADE_PLAN_EVENT');
                            
                            // Sort events properly by sequence, then by internal order for same sequence
                            const typeOrder: Record<string, number> = {
                                'STRATEGY_SIGNAL_EVENT': 1,
                                'STATE_TRANSITION_EVENT': 2,
                                'REALTIME_PRICE_EVENT': 3,
                                'RETRACEMENT_ZONE_TOUCHED': 4,
                                'RETRACEMENT_ENTRY_TRIGGERED': 5,
                                'TRADE_PLAN_EVENT': 6,
                                'POSITION_OPENED_EVENT': 7
                            };
                            events.sort((a:any, b:any) => {
                                if (a.event_sequence !== b.event_sequence) return a.event_sequence - b.event_sequence;
                                return typeOrder[a.event_type] - typeOrder[b.event_type];
                            });

                            // Check Trace Completeness
                            let traceStatus = 'INCOMPLETE TRACE';
                            let statusColor = 'text-amber-600 bg-amber-50 border-amber-200';
                            
                            if (hasPositionOpened) {
                                traceStatus = 'SUCCESS';
                                statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
                            } else if (hasTradePlan) {
                                traceStatus = 'EXECUTION FAILED (INCOMPLETE TRACE)';
                                statusColor = 'text-rose-700 bg-rose-50 border-rose-200';
                            }

                            return (
                                <Card key={traceGroup.signal.id} className="border-slate-200 overflow-hidden">
                                    <CardHeader className="bg-slate-50/80 py-3 border-b border-slate-100 flex flex-row items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <CardTitle className="text-sm font-bold text-slate-800 font-mono">
                                                {traceGroup.signal.payload?.trace?.correlationId}
                                            </CardTitle>
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${statusColor}`}>
                                                {traceStatus}
                                            </span>
                                        </div>
                                        <span className="text-xs text-slate-500 font-mono">
                                            {new Date(traceGroup.signal.timestamp).toLocaleString()}
                                        </span>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50/50">
                                                    <TableHead className="w-[180px]">Timestamp</TableHead>
                                                    <TableHead className="w-[80px]">Sequence</TableHead>
                                                    <TableHead>Event Type</TableHead>
                                                    <TableHead>Details</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {events.map((evt:any, idx:number) => (
                                                    <TableRow key={evt.id} className="hover:bg-slate-50/80">
                                                        <TableCell className="font-mono text-xs text-slate-600">
                                                            {new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }).format(new Date(evt.timestamp))} UTC
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs text-indigo-600 font-medium">
                                                            {evt.event_sequence}
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs font-bold text-slate-700">
                                                            {evt.event_type}
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs text-slate-600">
                                                            {evt.event_type === 'STATE_TRANSITION_EVENT' && `State: ${evt.payload.newState}`}
                                                            {evt.event_type === 'STRATEGY_SIGNAL_EVENT' && `Direction: ${evt.payload.direction}`}
                                                            {evt.event_type === 'REALTIME_PRICE_EVENT' && `Price: ${evt.payload.trade?.p || evt.payload.price}`}
                                                            {evt.event_type === 'RETRACEMENT_ENTRY_TRIGGERED' && `Price: ${evt.payload.entry_price || evt.payload.price || evt.payload.entryReferencePrice}`}
                                                            {evt.event_type === 'TRADE_PLAN_EVENT' && `Plan: ${evt.payload.direction} @ ${evt.payload.entryReferencePrice}`}
                                                            {evt.event_type === 'POSITION_OPENED_EVENT' && <span className="text-emerald-600 font-bold">Position Opened Successfully</span>}
                                                            <div className="text-[10px] text-slate-400 mt-1">Parent: {evt.payload?.trace?.parentId || 'None'}</div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
