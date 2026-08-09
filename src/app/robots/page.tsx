'use client';

import { useEffect, useState } from 'react';
import { Plus, Bot, Settings2, MoreHorizontal, Activity } from 'lucide-react';
import Link from 'next/link';

export default function RobotsPage() {
  const [robots, setRobots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/robots')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch robots');
        return res.json();
      })
      .then(data => {
        setRobots(data);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">RUNNING</span>;
      case 'PAUSED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">PAUSED</span>;
      case 'STOPPED':
      case 'ERROR':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">{status}</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  const getStateBadge = (state: string) => {
    switch(state) {
      case 'IDLE':
        return <span className="text-xs text-slate-500 font-medium">IDLE</span>;
      case 'POSITION_OPEN':
        return <span className="text-xs text-emerald-600 font-medium">POSITION OPEN</span>;
      default:
        return <span className="text-xs text-blue-600 font-medium">{state}</span>;
    }
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Robot Manager</h2>
          <p className="text-sm text-slate-500 mt-1">Manage and monitor your digital trading employees.</p>
        </div>
        <Link 
          href="/robots/create" 
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-slate-900 text-white hover:bg-slate-800 h-10 py-2 px-4"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Robot
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-white animate-pulse rounded-xl border border-slate-200" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
          Error: {error}
        </div>
      ) : robots.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center flex flex-col items-center justify-center">
          <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
            <Bot size={32} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No robots found</h3>
          <p className="text-slate-500 max-w-sm mb-6">You haven't created any trading robots yet. Create your first robot to start automating your trades.</p>
          <Link 
            href="/robots/create"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none bg-slate-900 text-white hover:bg-slate-800 h-10 py-2 px-4"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Robot
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Robot Name & Slug</th>
                  <th className="px-6 py-4 font-medium">Lifecycle</th>
                  <th className="px-6 py-4 font-medium">Current State</th>
                  <th className="px-6 py-4 font-medium">Configuration</th>
                  <th className="px-6 py-4 font-medium">Provider</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {robots.map((robot) => (
                  <tr key={robot.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <Bot size={16} />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{robot.name}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{robot.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(robot.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Activity size={14} className="text-slate-400" />
                        {getStateBadge(robot.current_state)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700 font-medium">{robot.trading_view_symbol} <span className="text-slate-400 font-normal">({robot.timeframe})</span></div>
                      <div className="text-xs text-slate-500 mt-0.5">{robot.signal_source}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700">{robot.provider}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-slate-400 hover:text-slate-600 p-2 rounded-md hover:bg-slate-100 transition-colors">
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
