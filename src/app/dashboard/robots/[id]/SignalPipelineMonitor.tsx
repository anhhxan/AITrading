'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Node statuses
type NodeStatus = 'IDLE' | 'SUCCESS' | 'ERROR'

interface PipelineState {
  correlationId: string | null;
  lastEventTime: string | null;
  tradingView: { status: NodeStatus, time?: string, error?: string };
  cloudflare: { status: NodeStatus, time?: string, error?: string };
  vercel: { status: NodeStatus, time?: string, error?: string };
  supabase: { status: NodeStatus, time?: string, error?: string, detail?: string };
  worker: { status: NodeStatus, time?: string, error?: string };
  tvSignal: { status: NodeStatus, time?: string, error?: string, detail?: string };
  strategyEngine: { status: NodeStatus, time?: string, error?: string };
  signalResult: { status: NodeStatus, time?: string, result?: string };
}

const defaultState: PipelineState = {
  correlationId: null,
  lastEventTime: null,
  tradingView: { status: 'IDLE' },
  cloudflare: { status: 'IDLE' },
  vercel: { status: 'IDLE' },
  supabase: { status: 'IDLE' },
  worker: { status: 'IDLE' },
  tvSignal: { status: 'IDLE' },
  strategyEngine: { status: 'IDLE' },
  signalResult: { status: 'IDLE' },
}

export default function SignalPipelineMonitor({ robotId }: { robotId: string }) {
  const [pipeline, setPipeline] = useState<PipelineState>(defaultState)
  const supabase = createClient()

  useEffect(() => {
    const fetchLatest = async () => {
       const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
       
       const { data: cmds } = await supabase.from('robot_commands')
         .select('*')
         .eq('robot_id', robotId)
         .eq('command_type', 'TV_SIGNAL')
         .gte('created_at', tenMinsAgo)
         .order('created_at', { ascending: false })
         .limit(1);

       if (cmds && cmds.length > 0) {
         const cmd = cmds[0];
         updatePipelineStateFromCommand(cmd, true);
         
         const { data: events } = await supabase.from('core_events')
           .select('*')
           .eq('robot_id', robotId)
           .eq('event_type', 'STRATEGY_SIGNAL_EVENT')
           .eq('correlation_id', cmd.correlation_id)
           .limit(1);
           
         if (events && events.length > 0) {
           updatePipelineStateFromEvent(events[0]);
         }
       }
    };
    fetchLatest();

    const commandsSub = supabase.channel('commands-monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'robot_commands', filter: `robot_id=eq.${robotId}` },
        (payload) => {
          const cmd = payload.new as any;
          if (!cmd || cmd.command_type !== 'TV_SIGNAL') return;
          updatePipelineStateFromCommand(cmd, false);
        }
      )
      .subscribe();

    const eventsSub = supabase.channel('events-monitor')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'core_events', filter: `robot_id=eq.${robotId}` },
        (payload) => {
          const ev = payload.new as any;
          if (ev.event_type !== 'STRATEGY_SIGNAL_EVENT') return;
          updatePipelineStateFromEvent(ev);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(commandsSub);
      supabase.removeChannel(eventsSub);
    }
  }, [robotId, supabase]);

  const updatePipelineStateFromCommand = (cmd: any, isInitialFetch: boolean) => {
      setPipeline(prev => {
        const isNew = prev.correlationId !== cmd.correlation_id;
        const state = isNew ? { ...defaultState, correlationId: cmd.correlation_id } : { ...prev };
        
        const time = new Date(cmd.created_at).toLocaleString();
        const curTime = new Date().toLocaleString();
        state.lastEventTime = isInitialFetch ? time : curTime;

        if (cmd.status === 'RECEIVED' || cmd.status === 'PROCESSING' || cmd.status === 'SUCCEEDED' || cmd.status === 'FAILED') {
          state.tradingView = { status: 'SUCCESS', time };
          state.cloudflare = { status: 'SUCCESS', time };
          state.vercel = { status: 'SUCCESS', time };
          state.supabase = { status: 'SUCCESS', time, detail: `Command: ${cmd.command_id.substring(0,8)}` };
        }

        if (cmd.status === 'PROCESSING' || cmd.status === 'SUCCEEDED') {
          const workerTime = isInitialFetch ? new Date(cmd.processed_at || cmd.created_at).toLocaleString() : curTime;
          state.worker = { status: 'SUCCESS', time: workerTime };
        }

        if (cmd.status === 'SUCCEEDED') {
          const tvTime = isInitialFetch ? new Date(cmd.processed_at || cmd.created_at).toLocaleString() : curTime;
          state.tvSignal = { status: 'SUCCESS', time: tvTime, detail: `Command: ${cmd.command_id.substring(0,8)}` };
        } else if (cmd.status === 'FAILED') {
          const errTime = isInitialFetch ? new Date(cmd.processed_at || cmd.created_at).toLocaleString() : curTime;
          state.worker = { status: 'SUCCESS', time: errTime };
          state.tvSignal = { status: 'ERROR', time: errTime, error: cmd.result?.error || 'Validation failed' };
        }

        return state;
      });
  };

  const updatePipelineStateFromEvent = (ev: any) => {
      setPipeline(prev => {
        if (prev.correlationId && prev.correlationId !== ev.correlation_id) return prev;

        const state = { ...prev };
        if (!state.correlationId) state.correlationId = ev.correlation_id;
        
        const time = new Date(ev.created_at).toLocaleString();
        state.lastEventTime = time;

        state.strategyEngine = { status: 'SUCCESS', time };
        
        const direction = ev.payload?.direction || 'UNKNOWN';
        state.signalResult = { status: 'SUCCESS', time, result: direction };

        return state;
      });
  };

  const renderNode = (name: string, data: { status: NodeStatus, time?: string, error?: string, detail?: string }, isLast = false) => {
    let icon = <div className="w-4 h-4 rounded-full bg-slate-700 border-2 border-slate-600" />;
    if (data.status === 'SUCCESS') {
      icon = (
        <div className="relative flex items-center justify-center w-4 h-4">
          <div className="w-3 h-3 rounded-full bg-emerald-400 absolute animate-ping opacity-75"></div>
          <div className="w-3 h-3 rounded-full bg-emerald-500 relative z-10 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
        </div>
      );
    } else if (data.status === 'ERROR') {
      icon = (
        <div className="relative flex items-center justify-center w-4 h-4">
          <div className="w-3 h-3 rounded-full bg-red-500 relative z-10 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-8 flex justify-center">
             {icon}
          </div>
          <div className="flex-1 py-1">
            <div className={`font-semibold text-sm ${data.status === 'SUCCESS' ? 'text-slate-200' : data.status === 'ERROR' ? 'text-red-400' : 'text-slate-500'}`}>{name}</div>
            {data.time && <div className="text-[10px] text-slate-500 font-mono">{data.time}</div>}
            {data.detail && data.status === 'SUCCESS' && <div className="text-[11px] text-slate-400 mt-0.5">{data.detail}</div>}
            {data.error && data.status === 'ERROR' && <div className="text-[11px] text-red-400 font-medium mt-0.5">Error: {data.error}</div>}
            {data.result && data.status === 'SUCCESS' && (
               <div className={`text-xs font-bold mt-1 ${data.result === 'LONG' || data.result === 'SHORT' ? 'text-emerald-400' : 'text-slate-400'}`}>
                 {data.result}
               </div>
            )}
          </div>
        </div>
        {!isLast && (
          <div className="flex items-center gap-4 h-8">
            <div className="flex-shrink-0 w-8 flex justify-center h-full">
              <div className={`w-[2px] h-full ${data.status === 'SUCCESS' ? 'bg-emerald-500/30' : 'bg-slate-700'}`}></div>
            </div>
            <div className="flex-1"></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#0b1120] border border-slate-800 rounded-xl shadow-xl overflow-hidden mb-6 mt-6">
      <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-[#0f172a]">
        <h3 className="font-bold text-white flex items-center tracking-wider text-sm">
          <div className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></div>
          SIGNAL PIPELINE MONITOR
        </h3>
        {pipeline.correlationId && (
          <span className="text-[10px] text-slate-400 font-mono px-2 py-1 bg-slate-800 rounded border border-slate-700">
            ID: {pipeline.correlationId.split('_').pop()}
          </span>
        )}
      </div>
      <div className="p-6">
        <div className="bg-[#0f172a] rounded-xl p-6 md:p-8 max-w-lg mx-auto shadow-inner border border-slate-800/50">
          {renderNode('TradingView', pipeline.tradingView)}
          {renderNode('Cloudflare', pipeline.cloudflare)}
          {renderNode('Vercel', pipeline.vercel)}
          {renderNode('Supabase', pipeline.supabase)}
          {renderNode('Railway Worker', pipeline.worker)}
          {renderNode('TV_SIGNAL', pipeline.tvSignal)}
          {renderNode('StrategyEngine', pipeline.strategyEngine)}
          {renderNode('Signal Result', pipeline.signalResult, true)}
        </div>
        <div className="mt-6 text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-slate-800/50 border border-slate-700 text-xs text-slate-400 font-mono">
            {pipeline.lastEventTime ? `LAST EVENT: ${pipeline.lastEventTime}` : 'WAITING FOR NEXT WEBHOOK...'}
          </div>
        </div>
      </div>
    </div>
  )
}
