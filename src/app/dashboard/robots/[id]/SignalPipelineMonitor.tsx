'use client'

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, Play, Clock, FileText, CheckCircle, AlertTriangle, ShieldAlert, ChevronDown, ChevronUp, Info, Crosshair, Zap } from 'lucide-react';

const TraceItem = ({ traceGroup, forensicEvents }: { traceGroup: any, forensicEvents: any[] }) => {
    const [expanded, setExpanded] = useState(false);
    const events = traceGroup.events || [];
    
    // Check Trace Completeness
    const hasPositionOpened = events.some((e:any) => e.event_type === 'POSITION_OPENED_EVENT');
    const hasTradePlan = events.some((e:any) => e.event_type === 'TRADE_PLAN_EVENT');
    
    // Type Order for sorting
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

    let traceStatus = 'ĐANG CHỜ';
    let statusColor = 'text-amber-600 bg-amber-50 border-amber-200';
    let StatusIcon = Clock;
    
    if (hasPositionOpened) {
        traceStatus = 'ĐÃ MỞ VỊ THẾ';
        statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
        StatusIcon = CheckCircle;
    } else if (hasTradePlan) {
        traceStatus = 'LỖI THỰC THI';
        statusColor = 'text-rose-700 bg-rose-50 border-rose-200';
        StatusIcon = AlertTriangle;
    }

    const signalEvent = events.find((e:any) => e.event_type === 'STRATEGY_SIGNAL_EVENT');
    const direction = signalEvent?.payload?.direction || 'UNKNOWN';

    // Tooltips translations
    const getEventDetails = (evt: any) => {
        switch (evt.event_type) {
            case 'STRATEGY_SIGNAL_EVENT': return { label: 'Tín hiệu chiến lược', icon: Play, desc: `Hướng: ${evt.payload.direction}`, color: 'text-blue-600' };
            case 'STATE_TRANSITION_EVENT': return { label: 'Chuyển trạng thái', icon: Activity, desc: `Trạng thái: ${evt.payload.newState}`, color: 'text-indigo-600' };
            case 'REALTIME_PRICE_EVENT': return { label: 'Giá thị trường (Realtime)', icon: Crosshair, desc: `Giá: ${evt.payload.trade?.p || evt.payload.price}`, color: 'text-slate-600' };
            case 'RETRACEMENT_ZONE_TOUCHED': return { label: 'Chạm vùng giá hồi', icon: ShieldAlert, desc: 'Giá đã đi vào vùng B3-B4', color: 'text-amber-600' };
            case 'RETRACEMENT_ENTRY_TRIGGERED': return { label: 'Kích hoạt vào lệnh', icon: Zap, desc: `Giá kích hoạt: ${evt.payload.entry_price || evt.payload.price || evt.payload.entryReferencePrice}`, color: 'text-orange-600' };
            case 'TRADE_PLAN_EVENT': return { label: 'Kế hoạch lệnh', icon: FileText, desc: `Kế hoạch: ${evt.payload.direction} @ ${evt.payload.entryReferencePrice}`, color: 'text-purple-600' };
            case 'POSITION_OPENED_EVENT': return { label: 'Đã mở vị thế', icon: CheckCircle, desc: 'Lệnh Paper Trading đã khớp', color: 'text-emerald-600' };
            default: return { label: evt.event_type, icon: Activity, desc: '', color: 'text-slate-500' };
        }
    };

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-4 shadow-sm">
            <div 
                className="bg-white hover:bg-slate-50 p-4 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <StatusIcon className={`w-6 h-6 ${statusColor.split(' ')[0]}`} />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">
                                {direction} · Chuỗi giao dịch
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusColor}`} title={traceStatus === 'ĐANG CHỜ' ? 'Hệ thống đã nhận tín hiệu nhưng chưa đủ điều kiện mở vị thế. Đây không phải lỗi.' : traceStatus === 'LỖI THỰC THI' ? 'Đã có kế hoạch lệnh nhưng hệ thống khớp lệnh thất bại.' : 'Lệnh Paper Execution đã ghi nhận thành công.'}>
                                {traceStatus}
                            </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-2">
                            <span title="Thời gian nhận tín hiệu ban đầu">
                                {new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(traceGroup.signal.timestamp))}
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1 cursor-help" title="Mã liên kết giao dịch (Correlation ID): dùng để liên kết tất cả sự kiện thuộc cùng một lần giao dịch.">
                                <Info className="w-3 h-3"/> {traceGroup.signal.payload?.trace?.correlationId?.split('_')?.slice(0,2)?.join('_') || traceGroup.signal.payload?.trace?.correlationId}
                            </span>
                            <span>·</span>
                            <span>{events.length} sự kiện</span>
                        </div>
                    </div>
                </div>
                <div className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    {expanded ? 'Thu gọn' : 'Xem chi tiết'}
                    {expanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                </div>
            </div>

            {expanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-0 sm:p-4">
                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead className="w-[120px]">Thời gian</TableHead>
                                    <TableHead className="w-[100px] cursor-help" title="Sequence: số thứ tự của chuỗi sự kiện trong EventBus. Các event nhân quả có thể dùng cùng sequence; điều này không có nghĩa là event bị trùng.">
                                        <div className="flex items-center gap-1">Sequence <Info className="w-3 h-3"/></div>
                                    </TableHead>
                                    <TableHead>Sự kiện</TableHead>
                                    <TableHead>Chi tiết</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {events.map((evt:any) => {
                                    const details = getEventDetails(evt);
                                    const Icon = details.icon;
                                    return (
                                        <TableRow key={evt.id} className="hover:bg-slate-50/80">
                                            <TableCell className="font-mono text-xs text-slate-600">
                                                {new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }).format(new Date(evt.timestamp))}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-indigo-600 font-medium">
                                                {evt.event_sequence}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Icon className={`w-4 h-4 ${details.color}`} />
                                                    <span className="font-semibold text-xs text-slate-700">{details.label}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-slate-600">
                                                {details.desc}
                                                <div className="text-[10px] text-slate-400 mt-0.5 cursor-help" title="Sự kiện cha (Parent Event ID)">
                                                    Cha: {evt.payload?.trace?.parentId || evt.trace?.parentId || 'Không có'}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Timeline View */}
                    <div className="md:hidden flex flex-col space-y-4 p-4">
                        {events.map((evt:any, idx:number) => {
                            const details = getEventDetails(evt);
                            const Icon = details.icon;
                            const isLast = idx === events.length - 1;
                            
                            return (
                                <div key={evt.id} className="flex gap-3 relative">
                                    {!isLast && <div className="absolute left-[11px] top-6 bottom-[-16px] w-0.5 bg-slate-200"></div>}
                                    <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center bg-white border border-slate-200 ${details.color}`}>
                                        <Icon className="w-3 h-3" />
                                    </div>
                                    <div className="flex-1 pb-1">
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-xs text-slate-800">{details.label}</span>
                                            <span className="font-mono text-[10px] text-slate-500">
                                                {new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(evt.timestamp))}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-600 font-mono mt-1">{details.desc}</div>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono">Seq: {evt.event_sequence}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function SignalPipelineMonitor({ robotId }: { robotId: string }) {
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

                    // Fetch injected Correlation IDs
                    const { data: relatedEvents2 } = await supabase.from('core_events')
                        .select('*').eq('robot_id', robotId)
                        .in('event_type', ['TRADE_PLAN_EVENT', 'POSITION_OPENED_EVENT', 'RETRACEMENT_ENTRY_TRIGGERED', 'STATE_TRANSITION_EVENT', 'RETRACEMENT_ZONE_TOUCHED'])
                        .order('event_sequence', { ascending: true });
                        
                    if (relatedEvents2) {
                         relatedEvents2.forEach(evt => {
                            const cid = evt.payload?.trace?.correlationId;
                            if (tracesMap.has(cid)) {
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
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'core_events', filter: `robot_id=eq.${robotId}` }, (payload) => {
                const newEvent = payload.new as any;
                setGoldenTraces(prev => {
                    const cid = newEvent.payload?.trace?.correlationId;
                    if (!cid) return prev;
                    
                    const newTraces = [...prev];
                    const existingGroup = newTraces.find(t => t.signal?.payload?.trace?.correlationId === cid);
                    
                    if (existingGroup) {
                        if (!existingGroup.events.some((e:any) => e.id === newEvent.id)) {
                            existingGroup.events.push(newEvent);
                        }
                    } else if (newEvent.event_type === 'STRATEGY_SIGNAL_EVENT') {
                        newTraces.unshift({ signal: newEvent, events: [newEvent] });
                        if (newTraces.length > 10) newTraces.pop();
                    }
                    return newTraces;
                });
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
                        <p className="text-muted-foreground">Giám sát chuỗi giao dịch và tín hiệu Phase 3</p>
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
                                        <span className="text-slate-500">Cặp giao dịch</span>
                                        <span className="font-mono font-medium">{feedHeartbeat.symbol}</span>
                                        
                                        <span className="text-slate-500">Giá hiện tại</span>
                                        <span className="font-mono font-bold text-lg">{feedHeartbeat.price?.toFixed(2)}</span>
                                        
                                        <span className="text-slate-500">Thời gian nhận</span>
                                        <span className="font-mono text-xs">
                                            {new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }).format(new Date(feedHeartbeat.eventTimestamp))}
                                        </span>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                                        <div className={`h-3 w-3 rounded-full ${feedHeartbeat.status === 'CONNECTED' ? 'bg-green-500' : feedHeartbeat.status === 'STALE' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                        <span className={`font-bold ${feedHeartbeat.status === 'CONNECTED' ? 'text-green-700' : feedHeartbeat.status === 'STALE' ? 'text-yellow-700' : 'text-red-700'}`}>
                                            {feedHeartbeat.status === 'CONNECTED' ? 'ĐÃ KẾT NỐI' : feedHeartbeat.status}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-slate-500 text-sm">Đang chờ kết nối feed...</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* RETRACEMENT MONITOR */}
                    {robotStatus?.current_state === 'WAIT_RETRACEMENT' && waitRetracementSignal && (
                        <Card className="border-amber-200">
                            <CardHeader className="bg-amber-50/50 py-3 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-semibold text-amber-800">GIÁM SÁT GIÁ HỒI</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <span className="text-slate-500">Hướng giao dịch</span>
                                    <span className={`font-bold ${waitRetracementSignal.direction === 'LONG' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {waitRetracementSignal.direction}
                                    </span>
                                    
                                    <span className="text-slate-500 flex items-center gap-1 cursor-help" title="Robot đang chờ giá quay về vùng B3-B4/B2-B3 theo hướng tín hiệu.">
                                        Vùng chờ <Info className="w-3 h-3"/>
                                    </span>
                                    <span className="font-mono text-amber-700 font-medium">
                                        {waitRetracementSignal.entryTrigger?.lower?.toFixed(2)} - {waitRetracementSignal.entryTrigger?.upper?.toFixed(2)}
                                    </span>
                                    
                                    <span className="text-slate-500">Giá hiện tại</span>
                                    <span className="font-mono font-bold">{feedHeartbeat?.price?.toFixed(2) || 'N/A'}</span>
                                    
                                    <span className="text-slate-500">Trạng thái</span>
                                    <span className="font-bold text-amber-600">ĐANG CHỜ GIÁ HỒI</span>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* GOLDEN TRACE MONITOR */}
                <div className="mt-8">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-600" />
                        Giám sát chuỗi giao dịch (Golden Trace)
                    </h2>
                    
                    {goldenTraces.length === 0 && !loading && (
                        <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                            Chưa có tín hiệu giao dịch nào.
                        </div>
                    )}

                    <div className="space-y-2">
                        {goldenTraces.map((traceGroup) => (
                            <TraceItem key={traceGroup.signal.id} traceGroup={traceGroup} forensicEvents={[]} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
