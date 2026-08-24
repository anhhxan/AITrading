'use client';
import { useEffect, useState, useMemo, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const StatusDot = ({ status }: { status?: string }) => {
    if (status === 'GREEN') return <div className="h-3 w-3 rounded-full bg-green-500 mx-auto" title="GREEN (Processed)" />;
    if (status === 'RED') return <div className="h-3 w-3 rounded-full bg-red-500 mx-auto" title="RED (Error)" />;
    return <div className="h-3 w-3 rounded-full bg-zinc-700 mx-auto border border-zinc-600" title="UNKNOWN / NOT OBSERVED" />;
};

function getFirstBreak(trace: any) {
    let maxGreen = -1;
    if (trace.tv_status === 'GREEN') maxGreen = Math.max(maxGreen, 0);
    if (trace.cf_status === 'GREEN') maxGreen = Math.max(maxGreen, 1);
    if (trace.vercel_status === 'GREEN') maxGreen = Math.max(maxGreen, 2);
    if (trace.db_status === 'GREEN') maxGreen = Math.max(maxGreen, 3);
    if (trace.poller_status === 'GREEN') maxGreen = Math.max(maxGreen, 4);
    if (trace.adapter_status === 'GREEN') maxGreen = Math.max(maxGreen, 5);
    if (trace.strategy_status === 'GREEN') maxGreen = Math.max(maxGreen, 6);

    if (maxGreen === 6) return null; // Complete
    if (maxGreen === -1) return 'NOT_OBSERVED';
    
    const nodes = ['TV', 'Cloudflare', 'Vercel', 'Database', 'Poller', 'Adapter', 'Strategy'];
    return nodes[maxGreen + 1];
}

export default function SignalPipelineMonitor({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const robotId = resolvedParams.id;
    const supabase = createClient();
    
    const [traces, setTraces] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [robotStatus, setRobotStatus] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!robotId || robotId === '') {
            setErrorMsg("Robot ID unavailable");
            console.error("[PIPELINE_MONITOR] Robot ID unavailable");
            setLoading(false);
            return;
        }

        console.log(`[PIPELINE_MONITOR] robotId = ${robotId}`);

        async function fetchData() {
            setLoading(true);
            setErrorMsg(null);
            
            try {
                const { data: events, error: eventsError } = await supabase
                    .from('signal_trace_events')
                    .select('*')
                    .eq('robot_id', robotId)
                    .order('bar_timestamp', { ascending: false })
                    .limit(1000);

                if (eventsError) {
                    console.error("[PIPELINE_MONITOR] signal_trace_events query failed", {
                        robotId,
                        message: eventsError.message,
                        code: eventsError.code,
                        details: eventsError.details
                    });
                    setErrorMsg(`Query failed: ${eventsError.message}`);
                    setLoading(false);
                    return;
                }

                if (events) {
                    setTraces(events);
                    console.log(`[PIPELINE_MONITOR] trace count = ${events.length}`);
                }

                const { data: robot, error: robotError } = await supabase
                    .from('robots')
                    .select('status, last_heartbeat_at')
                    .eq('id', robotId)
                    .single();
                
                if (robotError) {
                    console.error("[PIPELINE_MONITOR] robots query failed", robotError);
                } else if (robot) {
                    setRobotStatus(robot);
                    console.log(`[PIPELINE_MONITOR] heartbeat robotId = ${robotId} (${robot.last_heartbeat_at})`);
                }

            } catch (err: any) {
                console.error("[PIPELINE_MONITOR] Unexpected error", err);
                setErrorMsg(`Unexpected error: ${err.message}`);
            }
            
            setLoading(false);
        }
        
        fetchData();
        
        const sub = supabase.channel('signal_trace')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'signal_trace_events', filter: `robot_id=eq.${robotId}` }, () => {
                fetchData();
            })
            .subscribe();

        return () => { sub.unsubscribe(); }
    }, [robotId, supabase]);

    const stats = useMemo(() => {
        if (traces.length === 0) return null;
        
        const sorted = [...traces].sort((a, b) => a.bar_timestamp - b.bar_timestamp);
        const firstCandle = sorted[0].bar_timestamp;
        const lastCandle = sorted[sorted.length - 1].bar_timestamp;
        
        const expectedCount = Math.floor((lastCandle - firstCandle) / 60000) + 1;
        const receivedCount = traces.length;
        const missingCount = expectedCount - receivedCount;
        
        let completedPipeline = 0;
        const breaks = { TV: 0, Cloudflare: 0, Vercel: 0, Database: 0, Poller: 0, Adapter: 0, Strategy: 0, NOT_OBSERVED: 0 };
        
        traces.forEach(t => {
            const fb = getFirstBreak(t);
            if (!fb) completedPipeline++;
            else (breaks as any)[fb] = ((breaks as any)[fb] || 0) + 1;
        });
        
        if (missingCount > 0) {
            breaks.NOT_OBSERVED += missingCount;
        }

        const topBreak = Object.entries(breaks)
            .filter(([k,v]) => v > 0)
            .sort((a,b) => b[1] - a[1])[0];

        const gaps = [];
        for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i].bar_timestamp;
            const next = sorted[i+1].bar_timestamp;
            const diff = next - current;
            if (diff > 60000) {
                const missingInGap = Math.floor(diff / 60000) - 1;
                gaps.push({
                    from: current,
                    to: next,
                    missing: missingInGap,
                    firstBreak: 'UNKNOWN / NOT_OBSERVED'
                });
            }
        }

        return { expectedCount, receivedCount, missingCount, completedPipeline, breaks, topBreak, gaps, sorted };
    }, [traces]);

    const isWorkerOnline = robotStatus?.last_heartbeat_at && (Date.now() - new Date(robotStatus.last_heartbeat_at).getTime() < 60000);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">PAPER 1M — SIGNAL MONITOR</h1>
                    <p className="text-muted-foreground">Forensic Observability for 1M Webhook Signal Pipeline</p>
                </div>
                <Badge variant="outline" className="text-sm font-mono">{robotId || 'Unknown ID'}</Badge>
            </div>
            
            {errorMsg && (
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                    <strong>Error:</strong> {errorMsg}
                </div>
            )}

            {/* D. SUMMARY PANEL */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-slate-50">
                    <CardHeader className="py-3 px-4"><CardTitle className="text-sm text-slate-500">Pipeline Coverage</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-4">
                        <div className="text-2xl font-bold">{stats ? ((stats.receivedCount / stats.expectedCount)*100).toFixed(1) : 0}%</div>
                        <div className="text-xs text-slate-500 mt-1">Expected: {stats?.expectedCount || 0} | Received: {stats?.receivedCount || 0}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50">
                    <CardHeader className="py-3 px-4"><CardTitle className="text-sm text-slate-500">Missing Candles</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-4">
                        <div className="text-2xl font-bold text-red-600">{stats?.missingCount || 0}</div>
                        <div className="text-xs text-slate-500 mt-1">First Break Node: {stats?.topBreak?.[1] ? stats.topBreak[0] : 'N/A'}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50">
                    <CardHeader className="py-3 px-4"><CardTitle className="text-sm text-slate-500">Completed Pipeline</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-4">
                        <div className="text-2xl font-bold text-emerald-600">{stats?.completedPipeline || 0}</div>
                        <div className="text-xs text-slate-500 mt-1">Successfully evaluated by Strategy</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50">
                    <CardHeader className="py-3 px-4"><CardTitle className="text-sm text-slate-500">Worker Status</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-4">
                        <div className={`text-2xl font-bold ${isWorkerOnline ? 'text-emerald-600' : 'text-red-600'}`}>
                            {isWorkerOnline ? 'ONLINE' : 'OFFLINE'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            Heartbeat: {robotStatus?.last_heartbeat_at ? new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(robotStatus.last_heartbeat_at)) : 'N/A'}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* C. GAP ANALYSIS */}
            {stats && stats.gaps.length > 0 && (
                <Card className="border-red-200">
                    <CardHeader className="bg-red-50/50 py-3">
                        <CardTitle className="text-sm font-semibold text-red-800">Gap Analysis (Missing Candles)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>From (UTC)</TableHead>
                                    <TableHead>To (UTC)</TableHead>
                                    <TableHead>Missing Count</TableHead>
                                    <TableHead>Previous Node Break</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.gaps.map((gap, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-mono text-xs">{new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(gap.from))}</TableCell>
                                        <TableCell className="font-mono text-xs">{new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(gap.to))}</TableCell>
                                        <TableCell className="font-bold text-red-600">{gap.missing}</TableCell>
                                        <TableCell>{gap.firstBreak}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* A & B. PIPELINE TRACE (Realtime & History) */}
            <Card className="bg-black text-white border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between py-4">
                    <CardTitle className="text-lg">Realtime Pipeline Trace</CardTitle>
                    <div className="text-xs text-zinc-400">Displaying recent {traces.length} observations</div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-zinc-800 overflow-x-auto max-h-[600px]">
                        <Table>
                            <TableHeader className="sticky top-0 bg-black z-10">
                                <TableRow className="border-zinc-800 hover:bg-transparent">
                                    <TableHead className="w-[150px] text-zinc-400">Bar Time</TableHead>
                                    <TableHead className="text-center text-zinc-400 w-[60px]">TV</TableHead>
                                    <TableHead className="text-center text-zinc-400 w-[60px]">CF</TableHead>
                                    <TableHead className="text-center text-zinc-400 w-[80px]">Vercel</TableHead>
                                    <TableHead className="text-center text-zinc-400 w-[60px]">DB</TableHead>
                                    <TableHead className="text-center text-zinc-400 w-[80px]">Poller</TableHead>
                                    <TableHead className="text-center text-zinc-400 w-[80px]">Adapter</TableHead>
                                    <TableHead className="text-left text-zinc-400 w-[120px]">Strategy</TableHead>
                                    <TableHead className="text-right text-zinc-400">Correlation ID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8">Loading pipeline traces...</TableCell>
                                    </TableRow>
                                ) : traces.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8 text-zinc-500">No traces found for this robot.</TableCell>
                                    </TableRow>
                                ) : (
                                    traces.map((trace) => {
                                        const d = new Date(trace.bar_timestamp);
                                        const utcTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
                                        const vnTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
                                        
                                        return (
                                            <TableRow 
                                                key={trace.candle_trace_id} 
                                                className="border-zinc-800 hover:bg-zinc-900 cursor-pointer font-mono text-xs"
                                                title={`Received at: ${new Date(trace.created_at).toISOString()}`}
                                            >
                                                <TableCell className="font-medium text-zinc-300">
                                                    <div className="flex flex-col">
                                                        <span>UTC: {utcTime}</span>
                                                        <span className="text-zinc-500">VN: {vnTime}</span>
                                                    </div>
                                                </TableCell>
                                                
                                                <TableCell><StatusDot status={trace.tv_status === 'GREEN' ? 'GREEN' : 'UNKNOWN'} /></TableCell>
                                                <TableCell><StatusDot status={trace.cf_status} /></TableCell>
                                                <TableCell><StatusDot status={trace.vercel_status} /></TableCell>
                                                <TableCell><StatusDot status={trace.db_status} /></TableCell>
                                                <TableCell><StatusDot status={trace.poller_status} /></TableCell>
                                                <TableCell><StatusDot status={trace.adapter_status} /></TableCell>
                                                
                                                <TableCell>
                                                    <div className="flex items-center space-x-3">
                                                        <StatusDot status={trace.strategy_status} />
                                                        {trace.strategy_status === 'GREEN' && trace.strategy_result && (
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                                                trace.strategy_result === 'LONG' ? 'bg-green-900/50 text-green-400' :
                                                                trace.strategy_result === 'SHORT' ? 'bg-red-900/50 text-red-400' :
                                                                'bg-zinc-800 text-zinc-400'
                                                            }`}>
                                                                {trace.strategy_result}
                                                            </span>
                                                        )}
                                                        {trace.strategy_status !== 'GREEN' && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/50 text-zinc-500">
                                                                WAITING
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                
                                                <TableCell className="text-right text-zinc-500 text-[10px] max-w-[120px] truncate" title={trace.correlation_id}>
                                                    {trace.correlation_id || 'None'}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
