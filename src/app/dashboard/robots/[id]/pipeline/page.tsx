"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@supabase/supabase-js";
// import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"; // Depending on auth setup

type PipelineStatus = 'GRAY' | 'GREEN' | 'RED' | 'YELLOW';

interface SignalTrace {
    candle_trace_id: string;
    bar_timestamp: number;
    time_utc: string;
    correlation_id: string | null;
    command_id: string | null;
    request_id: string | null;
    
    tv_status: PipelineStatus;
    cf_status: PipelineStatus;
    vercel_status: PipelineStatus;
    db_status: PipelineStatus;
    poller_status: PipelineStatus;
    adapter_status: PipelineStatus;
    strategy_status: PipelineStatus;
    
    strategy_result: 'LONG' | 'SHORT' | 'NONE' | 'ERROR' | null;
}

const StatusDot = ({ status }: { status: PipelineStatus }) => {
    let colorClass = "bg-gray-300";
    if (status === 'GREEN') colorClass = "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]";
    if (status === 'RED') colorClass = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]";
    if (status === 'YELLOW') colorClass = "bg-yellow-400";

    return (
        <div className={`w-3 h-3 rounded-full mx-auto ${colorClass}`} />
    );
};

export default function PipelineMonitor() {
    const params = useParams();
    const robotId = params.id as string;
    
    const [traces, setTraces] = useState<SignalTrace[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch traces from the proposed signal_trace_events table
        // This is a stub since the table is pending migration
        const fetchTraces = async () => {
            // Mock data for UI demonstration based on the prompt's request
            const mockData: SignalTrace[] = [
                {
                    candle_trace_id: "1m_1787544060000",
                    bar_timestamp: 1787544060000,
                    time_utc: "12:31:00",
                    correlation_id: "tv_a9c2...",
                    command_id: "cmd_123",
                    request_id: "cf_req_1",
                    tv_status: 'GREEN', cf_status: 'GREEN', vercel_status: 'GREEN', db_status: 'GREEN', poller_status: 'GREEN', adapter_status: 'GREEN', strategy_status: 'GREEN',
                    strategy_result: 'NONE'
                },
                {
                    candle_trace_id: "1m_1787544120000",
                    bar_timestamp: 1787544120000,
                    time_utc: "12:32:00",
                    correlation_id: "tv_b3d4...",
                    command_id: "cmd_124",
                    request_id: "cf_req_2",
                    tv_status: 'GREEN', cf_status: 'GREEN', vercel_status: 'GREEN', db_status: 'GREEN', poller_status: 'GREEN', adapter_status: 'GREEN', strategy_status: 'GREEN',
                    strategy_result: 'NONE'
                },
                {
                    candle_trace_id: "1m_1787544180000",
                    bar_timestamp: 1787544180000,
                    time_utc: "12:33:00",
                    correlation_id: "tv_c5e6...",
                    command_id: "cmd_125",
                    request_id: "cf_req_3",
                    tv_status: 'GREEN', cf_status: 'GREEN', vercel_status: 'GREEN', db_status: 'GREEN', poller_status: 'GREEN', adapter_status: 'GREEN', strategy_status: 'GREEN',
                    strategy_result: 'LONG'
                },
                {
                    candle_trace_id: "1m_1787544240000",
                    bar_timestamp: 1787544240000,
                    time_utc: "12:34:00",
                    correlation_id: null,
                    command_id: null,
                    request_id: "cf_req_4",
                    tv_status: 'GREEN', cf_status: 'GREEN', vercel_status: 'GREEN', db_status: 'GRAY', poller_status: 'GRAY', adapter_status: 'GRAY', strategy_status: 'GRAY',
                    strategy_result: null
                },
                {
                    candle_trace_id: "1m_1787544300000",
                    bar_timestamp: 1787544300000,
                    time_utc: "12:35:00",
                    correlation_id: null,
                    command_id: null,
                    request_id: "cf_req_5",
                    tv_status: 'GREEN', cf_status: 'GREEN', vercel_status: 'GRAY', db_status: 'GRAY', poller_status: 'GRAY', adapter_status: 'GRAY', strategy_status: 'GRAY',
                    strategy_result: null
                },
                {
                    candle_trace_id: "1m_1787544360000",
                    bar_timestamp: 1787544360000,
                    time_utc: "12:36:00",
                    correlation_id: null,
                    command_id: null,
                    request_id: null,
                    tv_status: 'GRAY', cf_status: 'GRAY', vercel_status: 'GRAY', db_status: 'GRAY', poller_status: 'GRAY', adapter_status: 'GRAY', strategy_status: 'GRAY',
                    strategy_result: null
                }
            ];
            
            setTraces(mockData);
            setLoading(false);
        };

        fetchTraces();
    }, [robotId]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">PAPER 1M — SIGNAL PIPELINE</h1>
                    <p className="text-muted-foreground">Monitor webhook propagation across the entire infrastructure</p>
                </div>
                <Badge variant="outline" className="text-sm font-mono">{robotId}</Badge>
            </div>

            <Card className="bg-black text-white border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-lg">Realtime Pipeline Trace</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-zinc-800 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-transparent">
                                    <TableHead className="w-[100px] text-zinc-400">Time</TableHead>
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
                                ) : (
                                    traces.map((trace) => {
                                        // Determine if it's missing entirely (e.g. no evidence after TV/CF)
                                        const isMissing = trace.strategy_status === 'GRAY' && trace.vercel_status === 'GRAY' && trace.cf_status === 'GRAY';
                                        
                                        return (
                                            <TableRow 
                                                key={trace.candle_trace_id} 
                                                className="border-zinc-800 hover:bg-zinc-900 cursor-pointer font-mono text-sm"
                                                onClick={() => {
                                                    // In full implementation, this opens a dialog with trace details
                                                    console.log('Trace details:', trace);
                                                }}
                                            >
                                                <TableCell className="font-medium text-zinc-300">{trace.time_utc}</TableCell>
                                                
                                                <TableCell><StatusDot status={trace.tv_status} /></TableCell>
                                                <TableCell><StatusDot status={trace.cf_status} /></TableCell>
                                                <TableCell><StatusDot status={trace.vercel_status} /></TableCell>
                                                <TableCell><StatusDot status={trace.db_status} /></TableCell>
                                                <TableCell><StatusDot status={trace.poller_status} /></TableCell>
                                                <TableCell><StatusDot status={trace.adapter_status} /></TableCell>
                                                
                                                <TableCell>
                                                    <div className="flex items-center space-x-3">
                                                        <StatusDot status={trace.strategy_status} />
                                                        {trace.strategy_status === 'GREEN' && trace.strategy_result && (
                                                            <span className={`text-xs px-2 py-0.5 rounded ${
                                                                trace.strategy_result === 'LONG' ? 'bg-green-900/50 text-green-400' :
                                                                trace.strategy_result === 'SHORT' ? 'bg-red-900/50 text-red-400' :
                                                                'bg-zinc-800 text-zinc-400'
                                                            }`}>
                                                                {trace.strategy_result}
                                                            </span>
                                                        )}
                                                        {trace.strategy_status === 'GRAY' && (
                                                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800/50 text-zinc-500">
                                                                MISSING
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                
                                                <TableCell className="text-right text-zinc-500 text-xs">
                                                    {trace.correlation_id || <span className="text-zinc-700">None</span>}
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
