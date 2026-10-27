import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/adminApi';
import { getSafeExternalUrl } from '../../utils/sanitizeUrl';
import { getDisputes, resolveDispute, confirmReturn, handoverItem } from '../../services/api';
import type { Dispute } from '../../types';
import LogoutModal from '../../components/LogoutModal';
import { useAuth } from '../../context/AuthContext';
import {
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  X,
  ExternalLink,
  Lock,
  ShieldAlert,
  Clock,
  RefreshCw,
  XCircle,
  Eye,
  Handshake,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area
} from 'recharts';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [disputeNotification, setDisputeNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const fetchDisputes = async () => {
    setDisputesLoading(true);
    try {
      const data = await getDisputes();
      setDisputes(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load disputes:', err);
    } finally {
      setDisputesLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, [refreshKey]);

  const activeDisputesCount = useMemo(() => {
    return disputes.filter((d) => d.status === 'pending').length;
  }, [disputes]);

  useEffect(() => {
    if (disputeNotification) {
      const timer = setTimeout(() => setDisputeNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [disputeNotification]);

  const confirmLogout = async () => {
    try {
      await signOut(navigate);
    } catch {
      const isAdminRoute = window.location.pathname.startsWith('/admin');
      navigate(isAdminRoute ? '/admin/login' : '/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Toast Notification */}
      {disputeNotification && (
        <div
          className={`fixed top-4 right-4 z-[120] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 border ${
            disputeNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {disputeNotification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600" />
          )}
          <p className="text-sm font-bold">{disputeNotification.message}</p>
          <button
            onClick={() => setDisputeNotification(null)}
            className="ml-2 p-1 hover:bg-black/5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 opacity-50" />
          </button>
        </div>
      )}

      <nav className="bg-indigo-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <span className="font-bold text-xl tracking-wider">Lost and Found Admin</span>
              <div className="hidden md:flex space-x-2">
                {['overview', 'claims', 'items', 'disputes', 'activity'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 rounded-md text-sm font-medium capitalize flex items-center gap-1.5 transition-colors ${
                      activeTab === tab
                        ? 'bg-indigo-900 text-white'
                        : 'text-indigo-200 hover:bg-indigo-700 hover:text-white'
                    }`}
                  >
                    {tab === 'claims'
                      ? 'Claims Review'
                      : tab === 'disputes'
                      ? 'Active Disputes'
                      : tab.replace('-', ' ')}
                    {tab === 'disputes' && activeDisputesCount > 0 && (
                      <span className="bg-red-500 text-white text-[11px] px-2 py-0.5 rounded-full font-bold shadow-sm animate-pulse">
                        {activeDisputesCount}
                      </span>
                    )}
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
        {/* Top Alert Panel for Active Disputes (visible on all tabs when pending disputes exist, unless activeTab is already disputes) */}
        {activeDisputesCount > 0 && activeTab !== 'disputes' && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-red-500/10 via-amber-500/10 to-transparent border-l-4 border-red-500 p-4 rounded-r-2xl flex items-center justify-between shadow-xs bg-white">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚨</span>
                <div>
                  <h4 className="text-sm font-bold text-red-950">
                    {activeDisputesCount} Active Handover Dispute{activeDisputesCount > 1 ? 's' : ''} Awaiting Review
                  </h4>
                  <p className="text-xs text-red-800">
                    Contested item handovers require administrative review. Review evidence and initiate recall or reject the dispute.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('disputes')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <span>View Disputes</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'overview' && <OverviewTab refreshKey={refreshKey} />}
        {activeTab === 'claims' && <ClaimsTab />}
        {activeTab === 'items' && <ItemsTab refreshKey={refreshKey} />}
        {activeTab === 'disputes' && (
          <DisputesTab
            disputes={disputes}
            loading={disputesLoading}
            onRefresh={fetchDisputes}
            onNotification={(message, type) => setDisputeNotification({ message, type })}
          />
        )}
        {activeTab === 'activity' && <ActivityTab refreshKey={refreshKey} />}
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

// --- Active Disputes Components ---

interface DisputesTabProps {
  disputes: Dispute[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  onNotification: (message: string, type: 'success' | 'error') => void;
}

const DisputesTab = ({
  disputes,
  loading,
  onRefresh,
  onNotification,
}: DisputesTabProps) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'recall_pending' | 'rejected' | 'resolved'>('all');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null);
  const [confirmReturnLoading, setConfirmReturnLoading] = useState<string | null>(null);
  const [handoverLoading, setHandoverLoading] = useState<string | null>(null);
  const sanitizedProofUrl = selectedDispute
    ? getSafeExternalUrl(selectedDispute.proofUrl || '')
    : null;

  const handleHandoverItem = async (dispute: Dispute) => {
    if (!dispute.itemId?._id) return;
    const challengerId = dispute.challengerId?._id;
    const recipientName = dispute.challengerId?.name || 'challenger';
    const itemTitle = dispute.itemId?.title || 'item';

    const confirmed = window.confirm(
      `Confirm Final Handover:\n\nAre you sure you want to finalize handover of "${itemTitle}" to ${recipientName}? This will mark custody as returned and close the dispute lifecycle.`
    );
    if (!confirmed) return;

    setHandoverLoading(dispute._id);
    try {
      await handoverItem(dispute.itemId._id, {
        challengerId,
        verificationMethod: 'Department Physical Handover (Admin Verified)',
        verificationNotes: 'Handed over by Admin following dispute resolution.',
      });
      onNotification(`"${itemTitle}" successfully handed over to ${recipientName}!`, 'success');
      handleCloseModal();
      await onRefresh();
    } catch (err: any) {
      console.error('Failed to handover item:', err);
      onNotification(err.response?.data?.message || err.message || 'Failed to handover item', 'error');
    } finally {
      setHandoverLoading(null);
    }
  };

  const handleConfirmReturn = async (disputeId: string, itemTitle: string) => {
    const confirmed = window.confirm(
      `Confirm Physical Return:\n\nHas "${itemTitle}" been physically returned by the current owner and received at the department desk?\n\nClick OK to confirm return and notify the challenger that it is ready for pickup.`
    );
    if (!confirmed) return;

    setConfirmReturnLoading(disputeId);
    try {
      await confirmReturn(disputeId);
      onNotification(`Return confirmed for "${itemTitle}". Item is now ready for pickup.`, 'success');
      handleCloseModal();
      await onRefresh();
    } catch (err: any) {
      console.error('Failed to confirm return:', err);
      onNotification(err.response?.data?.message || err.message || 'Failed to confirm return', 'error');
    } finally {
      setConfirmReturnLoading(null);
    }
  };

  const filteredDisputes = useMemo(() => {
    if (statusFilter === 'all') return disputes;
    return disputes.filter((d) => d.status === statusFilter);
  }, [disputes, statusFilter]);

  const handleOpenReview = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setAdminNotes(dispute.adminNotes || '');
  };

  const handleCloseModal = () => {
    if (actionLoading) return;
    setSelectedDispute(null);
    setAdminNotes('');
  };

  const handleResolve = async (action: 'approve' | 'reject') => {
    if (!selectedDispute) return;
    setActionLoading(action);
    try {
      await resolveDispute(selectedDispute._id, {
        action,
        adminNotes: adminNotes.trim() || undefined,
      });
      onNotification(
        action === 'approve'
          ? 'Dispute approved and item recall initiated successfully.'
          : 'Dispute rejected successfully. The current owner keeps the item.',
        'success'
      );
      handleCloseModal();
      await onRefresh();
    } catch (err: any) {
      console.error('Failed to resolve dispute:', err);
      onNotification(err.response?.data?.message || err.message || 'Failed to resolve dispute', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" />
            Pending Review
          </span>
        );
      case 'recall_pending':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200 animate-pulse">
            <RefreshCw className="w-3 h-3" />
            Recall Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3 h-3" />
            Resolved
          </span>
        );
      case 'ready_for_pickup':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            Ready for Pickup
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 border border-gray-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-xl shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Active Disputes Management</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Review contested item handovers, examine proof of ownership, and resolve disputes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onRefresh()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-all shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(
          [
            { key: 'all', label: 'All Disputes', count: disputes.length },
            { key: 'pending', label: 'Pending Review', count: disputes.filter(d => d.status === 'pending').length },
            { key: 'recall_pending', label: 'Recall Pending', count: disputes.filter(d => d.status === 'recall_pending').length },
            { key: 'rejected', label: 'Rejected', count: disputes.filter(d => d.status === 'rejected').length },
            { key: 'resolved', label: 'Resolved', count: disputes.filter(d => d.status === 'resolved').length },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === f.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <span>{f.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                statusFilter === f.key
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table Container */}
      {filteredDisputes.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm text-center border border-gray-200">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-gray-100">
            🛡️
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">No Disputes Found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {statusFilter === 'all'
              ? 'There are currently no dispute records submitted in the system.'
              : `There are no disputes currently in "${statusFilter}" status.`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="py-3.5 px-4 sm:px-6">Item Title</th>
                  <th className="py-3.5 px-4 sm:px-6">Challenger</th>
                  <th className="py-3.5 px-4 sm:px-6">Current Owner</th>
                  <th className="py-3.5 px-4 sm:px-6">Status</th>
                  <th className="py-3.5 px-4 sm:px-6">Submitted</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredDisputes.map((dispute) => {
                  const item = dispute.itemId;
                  return (
                    <tr key={dispute._id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Item Title */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          {item?.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.title || 'Item'}
                              className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-xs shrink-0">
                              📦
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-gray-900 line-clamp-1">{item?.title || 'Unknown Item'}</p>
                            <span className="inline-block text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md mt-0.5 font-medium">
                              {item?.category || 'General'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Challenger */}
                      <td className="py-4 px-4 sm:px-6">
                        <div>
                          <p className="font-bold text-gray-900">{dispute.challengerId?.name || 'Unknown'}</p>
                          <p className="text-[11px] text-gray-500">{dispute.challengerId?.email || 'N/A'}</p>
                        </div>
                      </td>

                      {/* Current Owner */}
                      <td className="py-4 px-4 sm:px-6">
                        <div>
                          <p className="font-bold text-gray-900">{dispute.currentOwnerId?.name || 'Unknown'}</p>
                          <p className="text-[11px] text-gray-500">{dispute.currentOwnerId?.email || 'N/A'}</p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 sm:px-6">
                        {getStatusBadge(dispute.status)}
                      </td>

                      {/* Submitted */}
                      <td className="py-4 px-4 sm:px-6 text-gray-500 whitespace-nowrap">
                        {new Date(dispute.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        {dispute.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleOpenReview(dispute)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all border border-indigo-200/80 shadow-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </button>
                        )}

                        {dispute.status === 'recall_pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleConfirmReturn(dispute._id, item?.title || 'Item')}
                              disabled={confirmReturnLoading === dispute._id}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm shadow-emerald-200 disabled:opacity-50 active:scale-[0.98]"
                            >
                              {confirmReturnLoading === dispute._id ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Confirming…</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Confirm Return</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenReview(dispute)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl border border-gray-200"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {(dispute.status === 'rejected' || dispute.status === 'resolved') && (
                          <div className="flex items-center justify-end gap-2">
                            {dispute.status === 'resolved' && dispute.itemId?.custodyStatus === 'ready_for_pickup' ? (
                              <button
                                type="button"
                                onClick={() => handleHandoverItem(dispute)}
                                disabled={handoverLoading === dispute._id}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm shadow-blue-200 disabled:opacity-50 active:scale-[0.98]"
                              >
                                {handoverLoading === dispute._id ? (
                                  <>
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Handing Over…</span>
                                  </>
                                ) : (
                                  <>
                                    <Handshake className="w-3.5 h-3.5" />
                                    <span>Handover Item</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg bg-gray-100 text-gray-500 border border-gray-200">
                                {dispute.status === 'resolved' ? 'Returned / Closed' : 'Closed'}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenReview(dispute)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg border border-gray-200"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dispute Detail Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden my-8">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-xl shadow-xs">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900">Dispute Review</h3>
                    {getStatusBadge(selectedDispute.status)}
                  </div>
                  <p className="text-xs text-gray-500">Case ID: {selectedDispute._id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={actionLoading !== null}
                className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Item Card */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex items-center gap-4">
                {selectedDispute.itemId?.image_url ? (
                  <img
                    src={selectedDispute.itemId.image_url}
                    alt={selectedDispute.itemId.title}
                    className="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-200 text-gray-500 flex items-center justify-center text-2xl shrink-0">
                    📦
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold text-gray-900 truncate">
                    {selectedDispute.itemId?.title || 'Unknown Item'}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[11px] font-semibold text-gray-600 bg-white px-2.5 py-0.5 rounded-md border border-gray-200">
                      {selectedDispute.itemId?.category || 'General'}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-600 bg-white px-2.5 py-0.5 rounded-md border border-gray-200">
                      Custody: {selectedDispute.itemId?.custodyStatus || 'returned'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Parties Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4">
                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block mb-1">
                    Challenger (Disputant)
                  </span>
                  <p className="text-sm font-bold text-amber-950">{selectedDispute.challengerId?.name || 'Unknown'}</p>
                  <p className="text-xs text-amber-800 font-mono mt-0.5">{selectedDispute.challengerId?.email || 'N/A'}</p>
                </div>

                <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4">
                  <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block mb-1">
                    Current Item Holder
                  </span>
                  <p className="text-sm font-bold text-blue-950">{selectedDispute.currentOwnerId?.name || 'Unknown'}</p>
                  <p className="text-xs text-blue-800 font-mono mt-0.5">{selectedDispute.currentOwnerId?.email || 'N/A'}</p>
                </div>
              </div>

              {/* Challenger Reason */}
              <div>
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1.5">
                  Challenger's Stated Reason
                </span>
                <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-4">
                  <p className="text-xs sm:text-sm text-amber-950 whitespace-pre-wrap leading-relaxed font-medium">
                    {selectedDispute.reason}
                  </p>
                </div>
              </div>

              {/* Proof URL */}
              <div>
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1.5">
                  Ownership Proof Link
                </span>
                {sanitizedProofUrl ? (
                  <a
                    href={sanitizedProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-between w-full p-3.5 bg-blue-50/50 hover:bg-blue-50 text-blue-700 font-medium text-xs rounded-2xl border border-blue-200 transition-colors break-all"
                  >
                    <span className="truncate pr-2">{sanitizedProofUrl}</span>
                    <ExternalLink className="w-4 h-4 shrink-0 text-blue-600" />
                  </a>
                ) : (
                  <span>No valid proof link provided</span>
                )}
              </div>

              {/* Existing Admin Notes (if any) */}
              {selectedDispute.adminNotes && (
                <div>
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Previous Admin Notes
                  </span>
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-xs text-gray-700 font-medium">
                    {selectedDispute.adminNotes}
                  </div>
                </div>
              )}

              {/* Admin Notes Textarea */}
              <div>
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                  Admin Resolution Notes
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  placeholder="Enter decision reasoning, recall instructions, or case details..."
                  className="w-full text-xs sm:text-sm border border-gray-300 rounded-2xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-6 border-t border-gray-100 bg-gray-50/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={actionLoading !== null || confirmReturnLoading !== null}
                className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                Close
              </button>

              {selectedDispute.status === 'pending' && (
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleResolve('reject')}
                    disabled={actionLoading !== null}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-rose-200 disabled:opacity-50 active:scale-[0.98]"
                  >
                    {actionLoading === 'reject' ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Rejecting…</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        <span>Reject Dispute</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResolve('approve')}
                    disabled={actionLoading !== null}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-200 disabled:opacity-50 active:scale-[0.98]"
                  >
                    {actionLoading === 'approve' ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Initiating…</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Initiate Recall</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {selectedDispute.status === 'recall_pending' && (
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleConfirmReturn(selectedDispute._id, selectedDispute.itemId?.title || 'Item')}
                    disabled={confirmReturnLoading === selectedDispute._id}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-200 disabled:opacity-50 active:scale-[0.98]"
                  >
                    {confirmReturnLoading === selectedDispute._id ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Confirming…</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm Return</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {(selectedDispute.status === 'rejected' || selectedDispute.status === 'resolved') && (
                <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
                  {selectedDispute.status === 'resolved' && selectedDispute.itemId?.custodyStatus === 'ready_for_pickup' ? (
                    <button
                      type="button"
                      onClick={() => handleHandoverItem(selectedDispute)}
                      disabled={handoverLoading === selectedDispute._id}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-200 disabled:opacity-50 active:scale-[0.98]"
                    >
                      {handoverLoading === selectedDispute._id ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Handing Over…</span>
                        </>
                      ) : (
                        <>
                          <Handshake className="w-4 h-4" />
                          <span>Handover Item</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="text-xs text-gray-500 font-medium italic">
                      Case is {selectedDispute.status === 'resolved' ? 'resolved' : 'rejected'} and concluded.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- OverviewTab ---

const OverviewTab = ({ refreshKey }: { refreshKey?: number }) => {
  const [data, setData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .getOverview()
      .then((res) => {
        setData(res);
        adminApi
          .getItems()
          .then((resItems) => setItems(Array.isArray(resItems) ? resItems : []))
          .catch((err) => {
            console.error('Failed to load items for trend data:', err);
            setItems([]);
          })
          .finally(() => setLoading(false));
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [refreshKey]);

  // Trend Data Generation (Last 14 Days)
  const trendData = useMemo(() => {
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      return {
        dateString: d.toISOString().split('T')[0],
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        lost: 0,
        found: 0,
      };
    });

    if (!Array.isArray(items) || items.length === 0) return last14Days;

    items.forEach((item) => {
      try {
        const dateVal = item?.createdAt || item?.date_occurred;
        if (!dateVal) return;
        const dateStr = new Date(dateVal).toISOString().split('T')[0];
        const dayData = last14Days.find((d) => d.dateString === dateStr);
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
    { name: 'Active', value: data?.pendingItems || 0, color: '#f59e0b' },
    { name: 'Returned', value: data?.resolvedItems || 0, color: '#3b82f6' },
  ];

  // Insight Generation
  let itemInsight = 'Lost and found items are balanced.';
  if ((data?.foundItems || 0) > (data?.lostItems || 0)) {
    itemInsight = 'Found items currently exceed lost items, indicating high community participation.';
  } else if ((data?.lostItems || 0) > (data?.foundItems || 0)) {
    itemInsight = 'More items are reported lost than found. Encourage users to keep an eye out.';
  }

  let claimInsight = 'Claim activity is currently low.';
  if ((data?.pendingClaims || 0) > (data?.approvedClaims || 0) + (data?.rejectedClaims || 0)) {
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
          <h3 className="text-base font-bold text-gray-700 mb-6 text-center tracking-wide">
            Reports Trend (Last 14 Days)
          </h3>
          <div className="h-72 relative">
            {(!Array.isArray(items) || items.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/50 backdrop-blur-[1px]">
                <p className="text-gray-500 font-medium bg-white px-4 py-2 rounded shadow-sm border border-gray-100">
                  No trend data yet
                </p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorFound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
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

// --- ClaimsTab ---

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
    adminApi
      .getClaims()
      .then(setClaims)
      .catch((err) => setError(err.message))
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
        type: 'success',
      });
      setConfirmModal(null);
      fetchClaims();
    } catch (err: any) {
      setNotification({
        message: err.message || 'Failed to approve claim.',
        type: 'error',
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
        type: 'success',
      });
      setConfirmModal(null);
      fetchClaims();
    } catch (err: any) {
      setNotification({
        message: err.message || 'Failed to reject claim.',
        type: 'error',
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
        <div
          className={`fixed top-4 right-4 z-[110] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 border ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
              : 'bg-red-50 border-red-100 text-red-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600" />
          )}
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
          {claims.map((claim) => {
            const isManual = claim.claimType === 'manual_review';
            const reasonMap: Record<string, string> = {
              wrong_category: 'Wrong category selected',
              wording_difference: 'Different wording/title',
              location_mismatch: 'Location mismatch but details match',
              similar_appearance: 'Similar appearance/details',
              system_missed_match: 'System may have missed the match',
              other: 'Other',
            };
            return (
              <div
                key={claim._id}
                className={`bg-white rounded-xl shadow-md overflow-hidden border ${
                  isManual ? 'border-amber-400 ring-1 ring-amber-400' : 'border-gray-200'
                }`}
              >
                <div
                  className={`px-6 py-4 border-b flex justify-between items-center ${
                    isManual ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div>
                    <span className={`text-sm ${isManual ? 'text-amber-800' : 'text-gray-500'}`}>
                      Claim ID: {claim._id}
                    </span>
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
                      <p>
                        <span className="font-semibold text-gray-600">Category:</span>{' '}
                        {claim.foundItem?.category || 'N/A'}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-600">Location:</span>{' '}
                        {claim.foundItem?.location || 'N/A'}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-600">Custody:</span>{' '}
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                            claim.foundItem?.custodyStatus === 'returned'
                              ? 'bg-emerald-100 text-emerald-800'
                              : claim.foundItem?.custodyStatus === 'department_received'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {(claim.foundItem?.custodyStatus || 'not_handed_over').replace(/_/g, ' ')}
                        </span>
                      </p>
                      {(claim.foundItem?.custodyLocation || claim.foundItem?.custodyDepartment) && (
                        <p>
                          <span className="font-semibold text-gray-600">Held at:</span>{' '}
                          {claim.foundItem?.custodyLocation || claim.foundItem?.custodyDepartment}
                        </p>
                      )}
                      {claim.foundItem?.receiverName && (
                        <p>
                          <span className="font-semibold text-gray-600">Receiver:</span>{' '}
                          {claim.foundItem.receiverName}
                        </p>
                      )}
                      {claim.foundItem?.handoverDate && (
                        <p>
                          <span className="font-semibold text-gray-600">Handover date:</span>{' '}
                          {new Date(claim.foundItem.handoverDate).toLocaleString()}
                        </p>
                      )}
                      <p>
                        <span className="font-semibold text-gray-600">Date:</span>{' '}
                        {claim.foundItem?.date_occurred
                          ? new Date(claim.foundItem.date_occurred).toLocaleDateString()
                          : 'Unknown Date'}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-600">Description:</span>{' '}
                        {claim.foundItem?.description || 'N/A'}
                      </p>
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="font-semibold text-gray-800">Found By (Reporter):</p>
                        <p className="text-gray-600">
                          {claim.foundReporter?.name || 'Unknown'}{' '}
                          {claim.foundReporter?.email ? `(${claim.foundReporter.email})` : ''}
                        </p>
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
                      <p>
                        <span className="font-semibold text-gray-600">Category:</span>{' '}
                        {claim.lostItem?.category || 'N/A'}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-600">Location:</span>{' '}
                        {claim.lostItem?.location || 'N/A'}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-600">Date:</span>{' '}
                        {claim.lostItem?.date_occurred
                          ? new Date(claim.lostItem.date_occurred).toLocaleDateString()
                          : 'Unknown Date'}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-600">Description:</span>{' '}
                        {claim.lostItem?.description || 'N/A'}
                      </p>
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="font-semibold text-gray-800">Claimant (Lost Item Owner):</p>
                        <p className="text-gray-600">
                          {claim.claimant?.name || 'Unknown'}{' '}
                          {claim.claimant?.email ? `(${claim.claimant.email})` : ''}
                        </p>
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
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                    confirmModal.type === 'approve' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                  }`}
                >
                  {confirmModal.type === 'approve' ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    <AlertTriangle className="w-6 h-6" />
                  )}
                </div>
                <button onClick={() => setConfirmModal(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {confirmModal.type === 'approve' ? 'Approve claim?' : 'Reject claim?'}
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-8">
                {confirmModal.type === 'approve'
                  ? 'This will approve the claim, resolve the linked items, and may auto-reject other pending claims for this found item.'
                  : 'This will reject the claim. The linked items will remain active.'}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmModal.type === 'approve' ? executeApprove : executeReject}
                  disabled={actionLoading}
                  className={`w-full py-4 text-white font-bold rounded-2xl transition-all shadow-xl active:scale-[0.98] disabled:opacity-50 ${
                    confirmModal.type === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
                      : 'bg-red-600 hover:bg-red-700 shadow-red-100'
                  }`}
                >
                  {actionLoading
                    ? 'Processing...'
                    : confirmModal.type === 'approve'
                    ? 'Approve Claim'
                    : 'Reject Claim'}
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

// --- ItemsTab ---

const ItemsTab = ({ refreshKey }: { refreshKey?: number }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getItems()
      .then(setItems)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <div>Loading items...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">All Items Directory</h2>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type/Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Custody
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reporter
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-gray-900">{item.title}</div>
                    {item.isDisputed && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-800 border border-red-300">
                        🚨 Disputed
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {item.category} • {item.location}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      item.type === 'lost' ? 'bg-red-100 text-red-800' : 'bg-teal-100 text-teal-800'
                    }`}
                  >
                    {item.type.toUpperCase()}
                  </span>
                  <span
                    className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      item.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.status === 'resolved' ? 'RETURNED' : 'ACTIVE'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.type === 'found' ? (
                    <div>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                          item.custodyStatus === 'returned'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.custodyStatus === 'department_received'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {(item.custodyStatus || 'not_handed_over').replace(/_/g, ' ')}
                      </span>
                      {(item.custodyLocation || item.custodyDepartment) && (
                        <div className="text-xs mt-1">{item.custodyLocation || item.custodyDepartment}</div>
                      )}
                      {item.receiverName && <div className="text-xs mt-1">Receiver: {item.receiverName}</div>}
                      {item.handoverDate && (
                        <div className="text-xs mt-1">{new Date(item.handoverDate).toLocaleString()}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>{item.postedBy?.name || 'Unknown'}</div>
                  <div className="text-xs">{item.postedBy?.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(item.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  {item.custodyStatus === 'ready_for_pickup' && (
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = window.confirm(
                          `Confirm Handover:\n\nComplete final handover for "${item.title}" to the approved student? This will update custody status to returned.`
                        );
                        if (!confirmed) return;
                        try {
                          await adminApi.handoverItem(item._id);
                          alert(`Handover completed successfully for "${item.title}".`);
                          const updated = await adminApi.getItems();
                          setItems(updated);
                        } catch (err: any) {
                          alert(err.message || 'Failed to complete handover');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm shadow-blue-200"
                    >
                      <Handshake className="w-3.5 h-3.5" />
                      <span>Handover</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- ActivityTab ---

const ActivityTab = ({ refreshKey }: { refreshKey?: number }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getActivity()
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <div>Loading activity history...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Activity History</h2>
      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
        <ul className="divide-y divide-gray-200">
          {logs.length === 0 ? (
            <li className="px-6 py-8 text-center text-gray-500">No activity recorded yet.</li>
          ) : (
            logs.map((log) => (
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
                      <p className="flex items-center text-sm text-gray-700">{log.message}</p>
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
