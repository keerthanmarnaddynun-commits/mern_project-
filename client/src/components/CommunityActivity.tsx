import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, TrendingUp, CheckCircle, Search, Hash } from 'lucide-react';
import { getCommunityInsights } from '../services/api';

export default function CommunityActivity() {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCommunityInsights()
      .then((data) => {
        if (mounted) {
          setInsights(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load community insights:', err);
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
        <div className="h-4 w-64 bg-gray-100 rounded mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 rounded-xl mb-8" />
      </div>
    );
  }

  if (!insights) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-12">
      <div className="px-6 py-8 md:p-8 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Community Activity</h2>
        </div>
        <p className="text-gray-500 max-w-2xl">
          See how the community is helping recover lost items. These insights are based on public platform activity over the last 14 days.
        </p>
      </div>

      <div className="p-6 md:p-8 space-y-10">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <div className="text-sm font-medium text-blue-800 mb-1">Total Reports</div>
            <div className="text-2xl font-bold text-blue-900">{insights.stats.totalReports}</div>
          </div>
          <div className="bg-red-50/50 p-4 rounded-xl border border-red-100">
            <div className="text-sm font-medium text-red-800 mb-1">Lost Items</div>
            <div className="text-2xl font-bold text-red-900">{insights.stats.lostItems}</div>
          </div>
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
            <div className="text-sm font-medium text-emerald-800 mb-1">Found Items</div>
            <div className="text-2xl font-bold text-emerald-900">{insights.stats.foundItems}</div>
          </div>
          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
            <div className="text-sm font-medium text-amber-800 mb-1">Claims Submitted</div>
            <div className="text-2xl font-bold text-amber-900">{insights.stats.claimsSubmitted}</div>
          </div>
          <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 lg:col-span-1 col-span-2">
            <div className="text-sm font-medium text-purple-800 mb-1">Items Resolved</div>
            <div className="text-2xl font-bold text-purple-900">{insights.stats.itemsResolved}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Trend Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-500" />
              Reports Activity Over Time
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={insights.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pubColorLost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="pubColorFound" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area type="monotone" dataKey="lost" name="Lost Reports" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#pubColorLost)" />
                  <Area type="monotone" dataKey="found" name="Found Reports" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#pubColorFound)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-8">
            {/* Trending Categories */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-500" />
                Trending Categories
              </h3>
              <div className="flex flex-wrap gap-2">
                {insights.trendingCategories.length > 0 ? (
                  insights.trendingCategories.map((cat: string, i: number) => (
                    <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium">
                      {cat}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-500">Not enough data yet</span>
                )}
              </div>
            </div>

            {/* Recovery Insights */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-6 shadow-sm">
              <h3 className="text-base font-bold text-indigo-900 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-indigo-600" />
                Recovery Insights
              </h3>
              <p className="text-sm text-indigo-800 leading-relaxed font-medium">
                {insights.recoveryInsight}
              </p>
            </div>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div>
          <h3 className="text-base font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            Recent Community Activity
          </h3>
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-2">
            <ul className="divide-y divide-gray-200">
              {insights.recentActivity.length > 0 ? (
                insights.recentActivity.map((act: any) => (
                  <li key={act._id} className="p-4 flex items-center justify-between gap-4 hover:bg-gray-100/50 transition-colors rounded-lg">
                    <span className="text-sm text-gray-700 font-medium">{act.message}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(act.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </li>
                ))
              ) : (
                <li className="p-4 text-sm text-gray-500 text-center">No recent activity</li>
              )}
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
