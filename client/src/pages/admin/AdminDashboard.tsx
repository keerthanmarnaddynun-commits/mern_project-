import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../utils/adminApi';
import LogoutModal from '../../components/LogoutModal';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area
} from 'recharts';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();

  const confirmLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <nav className="bg-indigo-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <span className="font-bold text-xl tracking-wider">Lost and Found Admin</span>
              <div className="hidden md:flex space-x-2">
                {['overview', 'claims', 'items', 'activity'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 rounded-md text-sm font-medium capitalize ${
                      activeTab === tab ? 'bg-indigo-900 text-white' : 'text-indigo-200 hover:bg-indigo-700 hover:text-white'
                    }`}
                  >
                    {tab === 'claims' ? 'Claims Review' : tab.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <button
                onClick={() => setShowLogoutModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'claims' && <ClaimsTab />}
        {activeTab === 'items' && <ItemsTab />}
        {activeTab === 'activity' && <ActivityTab />}
      </main>

      <LogoutModal 
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        title="Sign out of Admin?"
      />
    </div>
  );
};

// --- Subcomponents ---

const OverviewTab = () => {
  const [data, setData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getOverview()
      .then(res => {
        setData(res);
        adminApi.getItems()
          .then(resItems => setItems(Array.isArray(resItems) ? resItems : []))
          .catch(err => {
            console.error("Failed to load items for trend data:", err);
            setItems([]);
          })
          .finally(() => setLoading(false));
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Trend Data Generation (Last 14 Days)
  const trendData = useMemo(() => {
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      return {
        dateString: d.toISOString().split('T')[0],
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        lost: 0,
        found: 0
      };
    });

    if (!Array.isArray(items) || items.length === 0) return last14Days;

    items.forEach(item => {
      try {
        const dateVal = item?.createdAt || item?.date_occurred;
        if (!dateVal) return;
        const dateStr = new Date(dateVal).toISOString().split('T')[0];
        const dayData = last14Days.find(d => d.dateString === dateStr);
        if (dayData) {
          if (item.type === 'lost') dayData.lost++;
          else if (item.type === 'found') dayData.found++;
        }
      } catch (e) {
        // ignore invalid dates
      }
    });

    return last14Days;
  }, [items]);

  if (loading && !data) return <div>Loading overview...</div>;
  if (error && !data) return <div className="text-red-500">{error}</div>;

  const cards = [
    { label: 'Total Users', value: data?.totalUsers || 0, color: 'bg-blue-100 text-blue-800' },
    { label: 'Total Items', value: data?.totalItems || 0, color: 'bg-purple-100 text-purple-800' },
    { label: 'Pending Claims', value: data?.pendingClaims || 0, color: 'bg-yellow-100 text-yellow-800' },
    { label: 'Approved Claims', value: data?.approvedClaims || 0, color: 'bg-green-100 text-green-800' },
    { label: 'Lost Items', value: data?.lostItems || 0, color: 'bg-red-100 text-red-800' },
    { label: 'Found Items', value: data?.foundItems || 0, color: 'bg-teal-100 text-teal-800' },
    { label: 'Resolved Items', value: data?.resolvedItems || 0, color: 'bg-gray-200 text-gray-800' },
    { label: 'Total Claims', value: data?.totalClaims || 0, color: 'bg-indigo-100 text-indigo-800' },
  ];

  // Chart Data Preparation
  const lostFoundData = [
    { name: 'Lost Items', value: data?.lostItems || 0, color: '#ef4444' },
    { name: 'Found Items', value: data?.foundItems || 0, color: '#14b8a6' },
  ];

  const claimsStatusData = [
    { name: 'Pending', count: data?.pendingClaims || 0, fill: '#eab308' },
    { name: 'Approved', count: data?.approvedClaims || 0, fill: '#22c55e' },
    { name: 'Rejected', count: data?.rejectedClaims || 0, fill: '#ef4444' },
  ];

  const resolutionData = [
    { name: 'Pending', value: data?.pendingItems || 0, color: '#f59e0b' },
    { name: 'Resolved', value: data?.resolvedItems || 0, color: '#3b82f6' },
  ];

  // Insight Generation
  let itemInsight = 'Lost and found items are balanced.';
  if ((data?.foundItems || 0) > (data?.lostItems || 0)) {
    itemInsight = 'Found items currently exceed lost items, indicating high community participation.';
  } else if ((data?.lostItems || 0) > (data?.foundItems || 0)) {
    itemInsight = 'More items are reported lost than found. Encourage users to keep an eye out.';
  }

  let claimInsight = 'Claim activity is currently low.';
  if ((data?.pendingClaims || 0) > ((data?.approvedClaims || 0) + (data?.rejectedClaims || 0))) {
    claimInsight = 'Most claims are currently pending. Prompt review is recommended.';
  } else if ((data?.approvedClaims || 0) > 0) {
    claimInsight = 'A healthy number of claims have been successfully approved.';
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {cards.map((c, i) => (
          <div key={i} className={`p-6 rounded-lg shadow-sm border border-gray-100 ${c.color}`}>
            <div className="text-sm font-medium uppercase tracking-wider opacity-80">{c.label}</div>
            <div className="mt-2 text-3xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-8 border-t border-gray-200 pt-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Platform Analytics</h2>
        
        <div className="flex flex-col md:flex-row gap-4 mb-8 text-sm">
          <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 px-5 py-4 rounded-xl flex-1 shadow-sm">
            <span className="font-bold block mb-1 uppercase tracking-wide text-xs opacity-80">Items Insight</span>
            {itemInsight}
          </div>
          <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 px-5 py-4 rounded-xl flex-1 shadow-sm">
            <span className="font-bold block mb-1 uppercase tracking-wide text-xs opacity-80">Claims Insight</span>
            {claimInsight}
          </div>
        </div>

        {/* Full-width Trend Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
          <h3 className="text-base font-bold text-gray-700 mb-6 text-center tracking-wide">Reports Trend (Last 14 Days)</h3>
          <div className="h-72 relative">
            {(!Array.isArray(items) || items.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/50 backdrop-blur-[1px]">
                <p className="text-gray-500 font-medium bg-white px-4 py-2 rounded shadow-sm border border-gray-100">No trend data yet</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Area type="monotone" dataKey="lost" name="Lost Reports" stroke="#ef4444" fillOpacity={1} fill="url(#colorLost)" />
                <Area type="monotone" dataKey="found" name="Found Reports" stroke="#14b8a6" fillOpacity={1} fill="url(#colorFound)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart 1: Lost vs Found Donut */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-base font-bold text-gray-700 mb-6 text-center tracking-wide">Lost vs Found</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={lostFoundData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {lostFoundData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`${value} Items`, 'Count']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Claims Status Bar */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-base font-bold text-gray-700 mb-6 text-center tracking-wide">Claims Status Overview</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={claimsStatusData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: '#f9fafb' }} 
                    formatter={(value: any) => [`${value} Claims`, 'Count']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    {claimsStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Items Resolution Pie */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-base font-bold text-gray-700 mb-6 text-center tracking-wide">Items Resolution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={resolutionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={80}
                    dataKey="value"
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {resolutionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`${value} Items`, 'Count']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClaimsTab = () => {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    id: string;
    type: 'approve' | 'reject';
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchClaims = () => {
    setLoading(true);
    adminApi.getClaims()
      .then(setClaims)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  const handleApproveClick = (id: string) => {
    setConfirmModal({ id, type: 'approve' });
  };

  const handleRejectClick = (id: string) => {
    setConfirmModal({ id, type: 'reject' });
  };

  const executeApprove = async () => {
    if (!confirmModal) return;
    setActionLoading(true);
    try {
      const res = await adminApi.approveClaim(confirmModal.id);
      setNotification({
        message: `${res.message}. Auto-rejected ${res.autoRejectedCount} other claim(s).`,
        type: 'success'
      });
      setConfirmModal(null);
      fetchClaims();
    } catch (err: any) {
      setNotification({
        message: err.message || 'Failed to approve claim.',
        type: 'error'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const executeReject = async () => {
    if (!confirmModal) return;
    setActionLoading(true);
    try {
      await adminApi.rejectClaim(confirmModal.id);
      setNotification({
        message: 'Claim rejected successfully.',
        type: 'success'
      });
      setConfirmModal(null);
      fetchClaims();
    } catch (err: any) {
      setNotification({
        message: err.message || 'Failed to reject claim.',
        type: 'error'
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && claims.length === 0) return <div>Loading claims...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="relative">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[110] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 border ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
            : 'bg-red-50 border-red-100 text-red-800'
        }`}>
          {notification.type === 'success' 
            ? <CheckCircle className="w-5 h-5 text-emerald-600" /> 
            : <AlertTriangle className="w-5 h-5 text-red-600" />}
          <p className="text-sm font-bold">{notification.message}</p>
          <button 
            onClick={() => setNotification(null)}
            className="ml-2 p-1 hover:bg-black/5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 opacity-50" />
          </button>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Pending Claims Review</h2>
        <button onClick={fetchClaims} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
          Refresh
        </button>
      </div>

      {claims.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
          No pending claims to review.
        </div>
      ) : (
        <div className="space-y-8">
          {claims.map(claim => {
            const isManual = claim.claimType === 'manual_review';
            const reasonMap: Record<string, string> = {
              wrong_category: 'Wrong category selected',
              wording_difference: 'Different wording/title',
              location_mismatch: 'Location mismatch but details match',
              similar_appearance: 'Similar appearance/details',
              system_missed_match: 'System may have missed the match',
              other: 'Other'
            };
            return (
              <div key={claim._id} className={`bg-white rounded-xl shadow-md overflow-hidden border ${isManual ? 'border-amber-400 ring-1 ring-amber-400' : 'border-gray-200'}`}>
                <div className={`px-6 py-4 border-b flex justify-between items-center ${isManual ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div>
                    <span className={`text-sm ${isManual ? 'text-amber-800' : 'text-gray-500'}`}>Claim ID: {claim._id}</span>
                    <span className="ml-4 text-xs font-semibold px-2.5 py-0.5 rounded bg-yellow-100 text-yellow-800">
                      {claim.status.toUpperCase()}
                    </span>
                    {isManual && (
                      <span className="ml-2 text-xs font-bold px-2.5 py-0.5 rounded bg-amber-200 text-amber-900 shadow-sm uppercase tracking-wide">
                        Manual Review Requested
                      </span>
                    )}
                  </div>
                  <div className={`text-sm ${isManual ? 'text-amber-700' : 'text-gray-600'}`}>
                    Submitted: {new Date(claim.createdAt).toLocaleString()}
                  </div>
                </div>

                {isManual && (
                  <div className="bg-amber-50/30 px-6 py-4 border-b border-amber-100">
                    <p className="text-sm font-semibold text-amber-900 mb-1">Reason for Manual Review:</p>
                    <p className="text-sm text-amber-800 bg-amber-100/50 px-3 py-2 rounded border border-amber-200/50">
                      <strong>{reasonMap[claim.manualReasonType] || claim.manualReasonType}</strong>
                      {claim.manualReasonText && (
                        <span className="block mt-1 pt-1 border-t border-amber-200/50 text-amber-700">
                          {claim.manualReasonText}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                  {/* Found Item Side */}
                <div className="p-6">
                  <h3 className="text-lg font-bold text-indigo-700 mb-4 flex items-center">
                    <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded mr-2">FOUND ITEM</span>
                    {claim.foundItem?.title || 'Unknown Item'}
                  </h3>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-semibold text-gray-600">Category:</span> {claim.foundItem?.category || 'N/A'}</p>
                    <p><span className="font-semibold text-gray-600">Location:</span> {claim.foundItem?.location || 'N/A'}</p>
                    <p><span className="font-semibold text-gray-600">Date:</span> {claim.foundItem?.date_occurred ? new Date(claim.foundItem.date_occurred).toLocaleDateString() : 'Unknown Date'}</p>
                    <p><span className="font-semibold text-gray-600">Description:</span> {claim.foundItem?.description || 'N/A'}</p>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="font-semibold text-gray-800">Found By (Reporter):</p>
                      <p className="text-gray-600">{claim.foundReporter?.name || 'Unknown'} {claim.foundReporter?.email ? `(${claim.foundReporter.email})` : ''}</p>
                    </div>
                  </div>
                </div>

                {/* Lost Item Side */}
                <div className="p-6">
                  <h3 className="text-lg font-bold text-red-700 mb-4 flex items-center">
                    <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded mr-2">LOST ITEM</span>
                    {claim.lostItem?.title || 'Unknown Item'}
                  </h3>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-semibold text-gray-600">Category:</span> {claim.lostItem?.category || 'N/A'}</p>
                    <p><span className="font-semibold text-gray-600">Location:</span> {claim.lostItem?.location || 'N/A'}</p>
                    <p><span className="font-semibold text-gray-600">Date:</span> {claim.lostItem?.date_occurred ? new Date(claim.lostItem.date_occurred).toLocaleDateString() : 'Unknown Date'}</p>
                    <p><span className="font-semibold text-gray-600">Description:</span> {claim.lostItem?.description || 'N/A'}</p>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="font-semibold text-gray-800">Claimant (Lost Item Owner):</p>
                      <p className="text-gray-600">{claim.claimant?.name || 'Unknown'} {claim.claimant?.email ? `(${claim.claimant.email})` : ''}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end space-x-4">
                <button
                  onClick={() => handleRejectClick(claim._id)}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 font-medium transition-colors"
                >
                  Reject Claim
                </button>
                <button
                  onClick={() => handleApproveClick(claim._id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium transition-colors shadow-sm"
                >
                  Approve & Resolve Items
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 animate-in zoom-in duration-200">
            <div className="p-6 sm:p-8">
              <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                  confirmModal.type === 'approve' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                }`}>
                  {confirmModal.type === 'approve' ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {confirmModal.type === 'approve' ? 'Approve claim?' : 'Reject claim?'}
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-8">
                {confirmModal.type === 'approve' 
                  ? "This will approve the claim, resolve the linked items, and may auto-reject other pending claims for this found item."
                  : "This will reject the claim. The linked items will remain active."}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmModal.type === 'approve' ? executeApprove : executeReject}
                  disabled={actionLoading}
                  className={`w-full py-4 text-white font-bold rounded-2xl transition-all shadow-xl active:scale-[0.98] disabled:opacity-50 ${
                    confirmModal.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : 'bg-red-600 hover:bg-red-700 shadow-red-100'
                  }`}
                >
                  {actionLoading ? 'Processing...' : (confirmModal.type === 'approve' ? 'Approve Claim' : 'Reject Claim')}
                </button>
                <button
                  onClick={() => setConfirmModal(null)}
                  disabled={actionLoading}
                  className="w-full py-4 bg-white text-gray-700 font-bold rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ItemsTab = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getItems().then(setItems).finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading items...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">All Items Directory</h2>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type/Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reporter</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map(item => (
              <tr key={item._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{item.title}</div>
                  <div className="text-sm text-gray-500">{item.category} • {item.location}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.type === 'lost' ? 'bg-red-100 text-red-800' : 'bg-teal-100 text-teal-800'}`}>
                    {item.type.toUpperCase()}
                  </span>
                  <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.status === 'resolved' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {item.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>{item.postedBy?.name || 'Unknown'}</div>
                  <div className="text-xs">{item.postedBy?.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(item.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ActivityTab = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getActivity().then(setLogs).finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading activity history...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Activity History</h2>
      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
        <ul className="divide-y divide-gray-200">
          {logs.length === 0 ? (
            <li className="px-6 py-8 text-center text-gray-500">No activity recorded yet.</li>
          ) : (
            logs.map(log => (
              <li key={log._id}>
                <div className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-indigo-600 truncate">
                      {log.type.toUpperCase().replace(/_/g, ' ')}
                    </p>
                    <div className="ml-2 flex-shrink-0 flex">
                      <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="flex items-center text-sm text-gray-700">
                        {log.message}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                      <p>
                        Actor: {log.actorName || 'System'} {log.actorEmail ? `(${log.actorEmail})` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default AdminDashboard;
