import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getMyReports, getReceivedClaims, getMyClaims } from '../services/api';
import type { Item } from '../types';
import Navbar from '../components/Navbar';
import { Activity, Clock, CheckCircle, MapPin, Tag, ArrowRight, PieChart, BarChart2, XCircle, Edit2, AlertCircle } from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function MyReports() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get('tab') === 'claims' ? 'claims' : 'items';

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'items' | 'claims'>(initialTab);
  const [receivedClaims, setReceivedClaims] = useState<any[]>([]);
  const [myClaims, setMyClaims] = useState<any[]>([]);
  const [historyTab, setHistoryTab] = useState<'submitted' | 'received'>('submitted');
  const [filter, setFilter] = useState<'all' | 'lost' | 'found' | 'pending' | 'resolved'>('all');

  useEffect(() => {
    let cancelled = false;
    const loadItems = async () => {
      try {
        const [itemsData, receivedData, myClaimsData] = await Promise.all([
          getMyReports(),
          getReceivedClaims(),
          getMyClaims()
        ]);
        if (!cancelled) {
          setItems(itemsData);
          setReceivedClaims(receivedData);
          setMyClaims(myClaimsData);
        }
      } catch (err: unknown) {
        if (!cancelled) setError('Failed to load your reports or claims.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadItems();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const lost = items.filter(i => i.type === 'lost').length;
    const found = items.filter(i => i.type === 'found').length;
    const pending = items.filter(i => i.status === 'pending').length;
    const resolved = items.filter(i => i.status === 'resolved' || i.is_resolved).length;
    return { total, lost, found, pending, resolved };
  }, [items]);

  const filteredItems = useMemo(() => {
    switch (filter) {
      case 'lost': return items.filter(i => i.type === 'lost');
      case 'found': return items.filter(i => i.type === 'found');
      case 'pending': return items.filter(i => i.status === 'pending');
      case 'resolved': return items.filter(i => i.status === 'resolved' || i.is_resolved);
      default: return items;
    }
  }, [items, filter]);

  const pieData = [
    { name: 'Lost', value: stats.lost },
    { name: 'Found', value: stats.found },
  ];
  const pieColors = ['#ef4444', '#10b981'];

  const barData = [
    { name: 'Active', count: stats.pending },
    { name: 'Returned', count: stats.resolved },
  ];
  const barColors = ['#f59e0b', '#3b82f6'];

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            My Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage the items you have reported.</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Reports</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500">Lost</p>
                    <p className="text-lg font-semibold text-red-600">{stats.lost}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Found</p>
                    <p className="text-lg font-semibold text-emerald-600">{stats.found}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Active</p>
                    <p className="text-lg font-semibold text-amber-600">{stats.pending}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Returned</p>
                    <p className="text-lg font-semibold text-blue-600">{stats.resolved}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                <h3 className="text-sm font-medium text-gray-500 mb-4 w-full text-left uppercase tracking-wide flex items-center gap-2">
                  <PieChart className="w-4 h-4" /> Item Types
                </h3>
                {stats.total > 0 ? (
                  <div className="w-full h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-400">No data</div>
                )}
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                <h3 className="text-sm font-medium text-gray-500 mb-4 w-full text-left uppercase tracking-wide flex items-center gap-2">
                  <BarChart2 className="w-4 h-4" /> Resolution Status
                </h3>
                {stats.total > 0 ? (
                  <div className="w-full h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                        <Tooltip cursor={{ fill: '#f9fafb' }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {barData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-400">No data</div>
                )}
              </div>

            </div>

            <div className="flex border-b border-gray-200 mb-6">
              <button
                onClick={() => setActiveTab('items')}
                className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'items'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                My Items
              </button>
              <button
                onClick={() => setActiveTab('claims')}
                className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'claims'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Claims History
                {receivedClaims.filter(c => c.status === 'pending').length > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {receivedClaims.filter(c => c.status === 'pending').length} New
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'items' ? (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-4">
              {(['all', 'lost', 'found', 'pending', 'resolved'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                    filter === tab
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {tab === 'pending' ? 'Active' : tab === 'resolved' ? 'Returned' : tab}
                </button>
              ))}
            </div>

            {filteredItems.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
                <p className="text-gray-500 text-sm">You haven't posted any items matching this filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map(item => (
                  <div key={item._id} className="bg-indigo-50/60 rounded-2xl border border-indigo-200 border-l-4 border-l-indigo-500 shadow-md shadow-indigo-100/50 hover:border-indigo-300 hover:shadow-lg transition-all overflow-hidden flex flex-col">
                    <div className="p-5 flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-2">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            item.type === 'lost' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {item.type}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            item.status === 'resolved' || item.is_resolved ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {item.status === 'resolved' || item.is_resolved ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {item.status === 'resolved' || item.is_resolved ? 'Returned' : 'Active'}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-gray-400">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2 line-clamp-1">{item.title}</h3>
                      
                      <div className="space-y-1.5 mt-4">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Tag className="w-3.5 h-3.5 text-gray-400" />
                          {item.category}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span className="truncate">{item.location}</span>
                        </div>
                        {item.type === 'found' && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            {item.custodyStatus === 'rejected' ? (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5 text-gray-400" />
                            )}
                            <span className="truncate">
                              Custody:{' '}
                              {item.custodyStatus === 'department_received'
                                ? item.custodyLocation || item.custodyDepartment || 'Department received'
                                : item.custodyStatus === 'returned'
                                  ? 'Returned to owner'
                                  : item.custodyStatus === 'rejected'
                                    ? 'Handover Denied'
                                    : 'Not handed over'}
                            </span>
                          </div>
                        )}
                        {item.custodyStatus === 'rejected' && (
                          <div className="mt-3.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                🚨 Handover Denied
                              </span>
                            </div>
                            <p className="text-xs text-rose-800 leading-relaxed font-medium">
                              The department could not verify physical receipt of this item. Please review and update your submitted information with the correct details. (Tip: You might have accidentally selected the wrong department.)
                            </p>
                            <div className="pt-1">
                              <Link
                                to={`/edit-item/${item._id}`}
                                state={{ openEdit: true }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Update Handover Details
                              </Link>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-[10px] font-medium text-gray-400">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md shadow-sm">
                            Your report
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t border-indigo-100 p-3 bg-indigo-50/50">
                      <Link
                        to={`/item/${item._id}`}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 text-sm font-medium rounded-xl shadow-sm transition-colors"
                      >
                        View Details
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
              </>
            ) : (
              // Claims History View
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-6">
                  <button
                    onClick={() => setHistoryTab('submitted')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                      historyTab === 'submitted'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Claims Submitted
                  </button>
                  <button
                    onClick={() => setHistoryTab('received')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                      historyTab === 'received'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Claims Received
                    {receivedClaims.filter(c => c.status === 'pending').length > 0 && (
                      <span className={`w-2 h-2 rounded-full ${historyTab === 'received' ? 'bg-white' : 'bg-amber-500'}`}></span>
                    )}
                  </button>
                </div>

                {(historyTab === 'submitted' ? myClaims : receivedClaims).length === 0 ? (
                  <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
                    <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {historyTab === 'submitted' ? 'No claims submitted' : 'No claims received'}
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {historyTab === 'submitted' 
                        ? 'You haven\'t submitted any claims for items yet.' 
                        : 'When someone claims one of your found items, it will appear here.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(historyTab === 'submitted' ? myClaims : receivedClaims).map(claim => (
                      <div 
                        key={claim._id} 
                        className={`bg-white rounded-2xl border p-6 shadow-sm transition-all hover:shadow-md ${
                          claim.status === 'pending' ? 'border-amber-200 ring-1 ring-amber-100/50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-5">
                          <div className="flex flex-wrap gap-2">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              claim.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                              claim.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {claim.status}
                            </span>
                            {claim.claimType === 'manual_review' && (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700">
                                Manual Review
                              </span>
                            )}
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700">
                              {historyTab === 'submitted' ? 'Your Claim' : 'Received Claim'}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            {new Date(claim.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="space-y-4 mb-6">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Found Item</p>
                              <p className="text-sm font-bold text-gray-900 leading-tight">{claim.itemId?.title || 'Unknown Item'}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Linked Lost Item</p>
                              <p className="text-sm font-bold text-gray-900 leading-tight">{claim.lostItemId?.title || 'Unknown Item'}</p>
                              {historyTab === 'received' && (
                                <p className="text-[11px] text-gray-500 mt-1 font-medium italic">
                                  Claimant: {claim.claimant?.name || 'Unknown'}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className={`rounded-xl p-4 flex items-start gap-3 ${
                          claim.status === 'pending' ? 'bg-amber-50/50' :
                          claim.status === 'approved' ? 'bg-emerald-50/50' :
                          'bg-gray-50'
                        }`}>
                          {claim.status === 'approved' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          ) : claim.status === 'rejected' ? (
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                          )}
                          <p className="text-xs text-gray-600 leading-relaxed font-medium">
                            {claim.status === 'pending' && "Admin will review and verify this claim. You do not need to take any action."}
                            {claim.status === 'approved' && "This claim was approved by admin."}
                            {claim.status === 'rejected' && "This claim was rejected by admin."}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
