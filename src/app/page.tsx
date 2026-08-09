'use client';

import { useEffect, useState } from 'react';
import { Activity, Bot, TrendingUp, AlertTriangle } from 'lucide-react';

type DashboardData = {
  totalRobots: number;
  runningRobots: number;
  openPositionsCount: number;
  realizedPnL: number;
  recentLogs: any[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        return res.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">System Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-32 bg-slate-200 animate-pulse rounded-xl border border-slate-100 shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
        <AlertTriangle className="h-6 w-6" />
        <div>
          <h3 className="font-semibold">Error Loading Dashboard</h3>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">System Overview</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Robots */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-slate-500 uppercase">Total Robots</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Bot className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-slate-800">{data.totalRobots > 0 ? data.totalRobots : '0'}</span>
            {data.totalRobots === 0 && <p className="text-xs text-slate-400 mt-1">NO ROBOTS</p>}
          </div>
        </div>

        {/* Running Robots */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-slate-500 uppercase">Running</span>
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-slate-800">{data.runningRobots > 0 ? data.runningRobots : '0'}</span>
          </div>
        </div>

        {/* Active Positions */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-slate-500 uppercase">Active Positions</span>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-slate-800">{data.openPositionsCount > 0 ? data.openPositionsCount : '0'}</span>
            {data.openPositionsCount === 0 && <p className="text-xs text-slate-400 mt-1">NO TRADES</p>}
          </div>
        </div>

        {/* Realized PnL */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-slate-500 uppercase">Realized PnL</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className={`text-3xl font-bold ${data.realizedPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {data.realizedPnL !== 0 ? `${data.realizedPnL > 0 ? '+' : ''}${data.realizedPnL} USDT` : '0 USDT'}
            </span>
            {data.realizedPnL === 0 && <p className="text-xs text-slate-400 mt-1">NO DATA</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Recent Logs Panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Recent Activity</h3>
          </div>
          <div className="p-0">
            {data.recentLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p>No recent activity logs.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentLogs.map((log) => (
                  <div key={log.id} className="p-4 flex gap-4 hover:bg-slate-50 transition-colors">
                    <div className="mt-1">
                      {log.level === 'ERROR' ? (
                        <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5" />
                      ) : log.level === 'WARN' ? (
                        <div className="h-2 w-2 rounded-full bg-orange-500 mt-1.5" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-slate-800">{log.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-medium text-slate-500">{log.category}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
