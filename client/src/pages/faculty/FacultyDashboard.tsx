import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  CheckCircle, 
  Clock, 
  MapPin, 
  Calendar, 
  User as UserIcon, 
  FileText, 
  AlertCircle, 
  RefreshCw,
  Tag,
  ExternalLink,
  Handshake,
  Mail,
  Info,
  XCircle,
  X,
  AlertTriangle
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { 
  fetchItems, 
  confirmItemReceipt, 
  denyItemReceipt,
  getDepartmentClaims, 
  approveClaim,
  rejectClaim
} from '../../services/api';
import type { Item } from '../../types';

interface DepartmentClaim {
  _id: string;
  status: string;
  claimType?: 'automatic' | 'manual_review';
  manualReasonType?: string;
  manualReasonText?: string;
  createdAt: string;
  claimant?: {
    _id: string;
    name: string;
    email: string;
  };
  itemId?: Item & { postedBy?: { name?: string; email?: string } };
  lostItemId?: Item & { postedBy?: { name?: string; email?: string } };
}

const REASON_LABELS: Record<string, string> = {
  wrong_category: 'Wrong category selected',
  wording_difference: 'Different wording / title',
  location_mismatch: 'Location mismatch but details match',
  similar_appearance: 'Similar appearance / details',
  system_missed_match: 'System may have missed the match',
  other: 'Other'
};

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [claims, setClaims] = useState<DepartmentClaim[]>([]);
  const [activeTab, setActiveTab] = useState<'receipts' | 'claims'>('claims');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Verification Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClaimToApprove, setSelectedClaimToApprove] = useState<DepartmentClaim | null>(null);
  const [verificationMethod, setVerificationMethod] = useState('Device Unlocked');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [modalError, setModalError] = useState('');

  // Generic Confirmation Modal State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  const denyReasonRef = useRef('');
  useEffect(() => {
    denyReasonRef.current = denyReason;
  }, [denyReason]);

  const [preventResubmit, setPreventResubmit] = useState(false);
  const preventResubmitRef = useRef(false);
  useEffect(() => {
    preventResubmitRef.current = preventResubmit;
  }, [preventResubmit]);

  const [confirmActionDetails, setConfirmActionDetails] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'danger' | 'success';
    actionType?: 'deny_claim' | 'general';
  } | null>(null);
  const [confirmActionHandler, setConfirmActionHandler] = useState<(() => Promise<void> | void) | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const openConfirmModal = (
    details: {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      confirmVariant?: 'danger' | 'success';
      actionType?: 'deny_claim' | 'general';
    },
    handler: () => Promise<void> | void
  ) => {
    setConfirmActionDetails(details);
    setConfirmActionHandler(() => handler);
    setIsConfirmModalOpen(true);
  };

  const closeConfirmModal = () => {
    if (confirmLoading) return;
    setIsConfirmModalOpen(false);
    setConfirmActionDetails(null);
    setConfirmActionHandler(null);
    setDenyReason('');
    setPreventResubmit(false);
  };

  const handleExecuteConfirm = async () => {
    if (!confirmActionHandler) return;
    try {
      setConfirmLoading(true);
      await confirmActionHandler();
      setIsConfirmModalOpen(false);
      setConfirmActionDetails(null);
      setConfirmActionHandler(null);
      setDenyReason('');
      setPreventResubmit(false);
    } finally {
      setConfirmLoading(false);
    }
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [itemsData, claimsData] = await Promise.all([
        fetchItems('found'),
        getDepartmentClaims()
      ]);
      setItems(itemsData);
      setClaims(claimsData);
    } catch {
      setError('Failed to load department dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Filter items matching user's department awaiting receipt confirmation
  const awaitingItems = items.filter(
    (item) =>
      (item.custodyDepartment === user?.department || item.custodyLocation === user?.department) &&
      item.custodyStatus === 'awaiting_confirmation'
  );

  const executeConfirmReceipt = async (itemId: string) => {
    setActionLoading(`confirm-${itemId}`);
    setSuccessMessage(null);
    setError('');
    try {
      await confirmItemReceipt(itemId);
      setSuccessMessage('Item receipt confirmed successfully. Custody is now recorded under your department.');
      setToast({ message: 'Item receipt confirmed successfully.', type: 'success' });
      await loadAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to confirm item receipt. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const promptConfirmReceipt = (item: Item) => {
    openConfirmModal(
      {
        title: 'Confirm Action',
        message: `Are you sure you want to accept "${item.title}" into ${user?.department || 'department'} custody?`,
        confirmText: 'Confirm Receipt',
        confirmVariant: 'success',
      },
      () => executeConfirmReceipt(item._id)
    );
  };

  const executeDenyReceipt = async (itemId: string) => {
    setActionLoading(`deny-${itemId}`);
    setSuccessMessage(null);
    setError('');
    try {
      await denyItemReceipt(itemId);
      setSuccessMessage('Handover denied');
      setToast({ message: 'Handover denied', type: 'success' });
      await loadAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to deny item receipt. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const promptDenyReceipt = (item: Item) => {
    openConfirmModal(
      {
        title: 'Confirm Action',
        message: `Are you sure you want to deny receipt for "${item.title}"? Custody will not be accepted.`,
        confirmText: 'Deny Receipt',
        confirmVariant: 'danger',
      },
      () => executeDenyReceipt(item._id)
    );
  };

  const handleOpenVerificationModal = (claim: DepartmentClaim) => {
    setSelectedClaimToApprove(claim);
    setVerificationMethod('Device Unlocked');
    setVerificationNotes('');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (actionLoading || confirmLoading) return;
    setIsModalOpen(false);
    setSelectedClaimToApprove(null);
    setVerificationNotes('');
    setModalError('');
  };

  const handleConfirmReturn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedClaimToApprove) return;

    if (!verificationNotes.trim()) {
      setModalError('Verification notes are required before completing the return.');
      return;
    }

    setActionLoading(`approve-${selectedClaimToApprove._id}`);
    setModalError('');
    setError('');
    try {
      await approveClaim(selectedClaimToApprove._id, {
        verificationMethod,
        verificationNotes: verificationNotes.trim(),
      });
      setSuccessMessage('Item successfully returned!');
      setToast({ message: 'Item successfully returned!', type: 'success' });
      setIsModalOpen(false);
      setSelectedClaimToApprove(null);
      setVerificationNotes('');
      await loadAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setModalError(msg || 'Failed to approve claim and record return. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const executeReject = async (claimId: string) => {
    const reasonToSend = denyReasonRef.current.trim();
    const prevent = preventResubmitRef.current;
    setActionLoading(`reject-${claimId}`);
    setError('');
    try {
      await rejectClaim(claimId, { reason: reasonToSend, preventResubmit: prevent });
      setToast({ message: 'Claim denied', type: 'success' });
      setSuccessMessage('Claim denied');
      await loadAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to deny claim. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const promptRejectClaim = (claim: DepartmentClaim) => {
    setDenyReason('');
    setPreventResubmit(false);
    openConfirmModal(
      {
        title: 'Deny Claim',
        message: `Are you sure you want to deny this claim for "${claim.itemId?.title || 'this item'}"? Please provide a reason below.`,
        confirmText: 'Deny Claim',
        confirmVariant: 'danger',
        actionType: 'deny_claim',
      },
      () => executeReject(claim._id)
    );
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header Banner */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Building2 className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Faculty Custody Dashboard</h1>
            </div>
            <p className="text-sm text-gray-500">
              Department:{' '}
              <span className="font-semibold text-gray-800">
                {user?.department || 'No department assigned'}
              </span>
            </p>
          </div>

          <button
            onClick={loadAll}
            disabled={loading}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Department Warning */}
        {!user?.department && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold">No Department Assigned</p>
              <p className="mt-0.5 text-amber-700">
                Your account does not have a department set. Department items and pending claims cannot be filtered until an administrator assigns your department.
              </p>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-emerald-800 text-sm">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 gap-2">
          <button
            onClick={() => setActiveTab('claims')}
            className={`pb-3.5 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'claims'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Handshake className="w-4 h-4" />
            Pending Claims
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'claims'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {claims.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('receipts')}
            className={`pb-3.5 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'receipts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            Items Awaiting Receipt
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'receipts'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {awaitingItems.length}
            </span>
          </button>
        </div>

        {/* Section 1: Items Awaiting Receipt */}
        {activeTab === 'receipts' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Items Awaiting Receipt Confirmation
              </h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : awaitingItems.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3 text-emerald-600">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">No Items Awaiting Receipt</h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  All items handed over to{' '}
                  <span className="font-semibold">{user?.department || 'your department'}</span> have been confirmed.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {awaitingItems.map((item) => (
                  <div
                    key={item._id}
                    className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
                  >
                    <div className="relative h-44 bg-gray-100 overflow-hidden">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                          <Tag className="w-10 h-10 text-gray-300" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
                          Awaiting Confirmation
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 backdrop-blur-sm text-gray-700 border border-gray-200">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{item.title}</h3>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-1">{item.description}</p>
                        </div>

                        <div className="space-y-1.5 text-xs text-gray-600 bg-gray-50 p-3 rounded-xl">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">Found at: {item.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span>Date found: {formatDate(item.date_occurred)}</span>
                          </div>
                          {item.receiverName && (
                            <div className="flex items-center gap-2">
                              <UserIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span>Reported Receiver: {item.receiverName} {item.receiverRole ? `(${item.receiverRole})` : ''}</span>
                            </div>
                          )}
                          {item.handoverNotes && (
                            <div className="flex items-start gap-2 pt-1 border-t border-gray-200/60">
                              <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                              <span className="italic line-clamp-2">"{item.handoverNotes}"</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                        <Link
                          to={`/item/${item._id}`}
                          state={{ fromFaculty: true }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-blue-600 transition-colors"
                        >
                          Details <ExternalLink className="w-3.5 h-3.5" />
                        </Link>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => promptDenyReceipt(item)}
                            disabled={actionLoading === `deny-${item._id}` || actionLoading === `confirm-${item._id}`}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 disabled:opacity-50 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-[0.98]"
                          >
                            <XCircle className="w-4 h-4 text-red-500" />
                            {actionLoading === `deny-${item._id}` ? 'Denying...' : 'Deny Receipt'}
                          </button>

                          <button
                            type="button"
                            onClick={() => promptConfirmReceipt(item)}
                            disabled={actionLoading === `deny-${item._id}` || actionLoading === `confirm-${item._id}`}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-[0.98]"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {actionLoading === `confirm-${item._id}` ? 'Confirming...' : 'Confirm Receipt'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 2: Pending Claims */}
        {activeTab === 'claims' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Handshake className="w-5 h-5 text-blue-600" />
                Department Claims Awaiting Verification & Handover
              </h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : claims.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3 text-blue-600">
                  <Handshake className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">No Pending Claims</h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  There are currently no active claims submitted for items held by{' '}
                  <span className="font-semibold">{user?.department || 'your department'}</span>.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {claims.map((claim) => {
                  const isManual = claim.claimType === 'manual_review';
                  const found = claim.itemId;
                  const lost = claim.lostItemId;
                  const claimant = claim.claimant;

                  return (
                    <div
                      key={claim._id}
                      className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${
                        isManual ? 'border-amber-300 ring-1 ring-amber-300' : 'border-gray-200'
                      }`}
                    >
                      {/* Claim Header */}
                      <div
                        className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-2 ${
                          isManual ? 'bg-amber-50/70 border-amber-200' : 'bg-gray-50/80 border-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-semibold text-gray-500">
                            Claim ID: {claim._id.slice(-8)}
                          </span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                              isManual
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isManual ? 'Manual Review' : 'Automatic Match'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Submitted: {new Date(claim.createdAt).toLocaleString()}
                        </div>
                      </div>

                      {/* Manual Review Reason Banner */}
                      {isManual && (
                        <div className="bg-amber-50/40 px-6 py-3 border-b border-amber-100 flex items-start gap-2.5 text-xs text-amber-900">
                          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Review Reason: </span>
                            <span>{REASON_LABELS[claim.manualReasonType || ''] || claim.manualReasonType || 'General'}</span>
                            {claim.manualReasonText && (
                              <p className="mt-1 text-amber-800 italic">"{claim.manualReasonText}"</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Side-by-Side Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                        {/* Found Item Side */}
                        <div className="p-6 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-100 text-emerald-800">
                              Found Item in Custody
                            </span>
                            <span className="text-xs text-gray-400">• {found?.category || 'N/A'}</span>
                          </div>

                          <h3 className="text-base font-bold text-gray-900">
                            {found?.title || 'Unknown Item'}
                          </h3>

                          {found?.description && (
                            <p className="text-xs text-gray-600 line-clamp-3">
                              {found.description}
                            </p>
                          )}

                          <div className="space-y-1.5 text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span>Found at: {found?.location || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span>Found date: {found?.date_occurred ? formatDate(found.date_occurred) : 'N/A'}</span>
                            </div>
                            {found?.receiverName && (
                              <div className="flex items-center gap-2">
                                <UserIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span>Receiver: {found.receiverName} {found.receiverRole ? `(${found.receiverRole})` : ''}</span>
                              </div>
                            )}
                            {found?.handoverNotes && (
                              <div className="flex items-start gap-2 pt-1 border-t border-gray-200/60">
                                <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                                <span className="italic">Handover Notes: "{found.handoverNotes}"</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Matched Lost Item Side */}
                        <div className="p-6 space-y-3 bg-slate-50/30">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-red-100 text-red-800">
                              Claimed Lost Report
                            </span>
                            <span className="text-xs text-gray-400">• {lost?.category || 'N/A'}</span>
                          </div>

                          <h3 className="text-base font-bold text-gray-900">
                            {lost?.title || 'Unknown Lost Item'}
                          </h3>

                          {lost?.description && (
                            <p className="text-xs text-gray-600 line-clamp-3">
                              {lost.description}
                            </p>
                          )}

                          <div className="space-y-1.5 text-xs text-gray-600 bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
                            <div className="flex items-center gap-2 font-medium text-gray-900">
                              <UserIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              <span>Claimant: {claimant?.name || 'Unknown'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-500">
                              <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span>{claimant?.email || 'No email provided'}</span>
                            </div>
                            <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span>Lost location: {lost?.location || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span>Lost date: {lost?.date_occurred ? formatDate(lost.date_occurred) : 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Claim Action Bar */}
                      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
                        <div className="text-xs text-gray-500">
                          Verify claimant identity and match before handing over the item.
                        </div>

                        <div className="flex items-center gap-3">
                          {found?._id && (
                            <Link
                              to={`/item/${found._id}`}
                              state={{
                                fromFaculty: true,
                                lostItemId: (claim.lostItemId as any)?._id || claim.lostItemId,
                              }}
                              className="px-3 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors flex items-center gap-1"
                            >
                              View Item Details <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          )}

                          <button
                            type="button"
                            onClick={() => promptRejectClaim(claim)}
                            disabled={actionLoading === `reject-${claim._id}` || actionLoading === `approve-${claim._id}`}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-red-200 hover:bg-red-50 text-red-600 font-bold text-xs rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            {actionLoading === `reject-${claim._id}` ? 'Denying...' : 'Deny'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenVerificationModal(claim)}
                            disabled={actionLoading === `approve-${claim._id}` || actionLoading === `reject-${claim._id}`}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-100 active:scale-[0.98]"
                          >
                            <Handshake className="w-4 h-4" />
                            {actionLoading === `approve-${claim._id}` ? 'Processing Handover...' : 'Approve & Handover'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[110] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 border ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <p className="text-xs font-bold">{toast.message}</p>
          <button
            onClick={() => setToast(null)}
            className="p-1 hover:bg-black/5 rounded-lg transition-colors ml-2"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* Handover Verification Modal */}
      {isModalOpen && selectedClaimToApprove && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="verification-modal-title"
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 my-8">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                  <Handshake className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="verification-modal-title" className="text-base font-bold text-gray-900">
                    Handover Verification
                  </h3>
                  <p className="text-xs text-gray-500">
                    Record verification details before marking item as returned.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={Boolean(actionLoading)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmReturn} className="p-6 space-y-5">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-800 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Read-Only Claimant & Item Information */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  Claimant Information
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 block">Claimant Name</span>
                    <span className="font-semibold text-gray-900">
                      {selectedClaimToApprove.claimant?.name || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Claimant Email</span>
                    <span className="font-semibold text-gray-900 break-all">
                      {selectedClaimToApprove.claimant?.email || 'No email provided'}
                    </span>
                  </div>
                </div>

                {selectedClaimToApprove.itemId && (
                  <div className="pt-2.5 border-t border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 block">Found Item to Return</span>
                      <span className="font-semibold text-gray-900">
                        {selectedClaimToApprove.itemId.title || 'Untitled Item'}
                      </span>
                    </div>
                    {selectedClaimToApprove.itemId.category && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-medium">
                        {selectedClaimToApprove.itemId.category}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Verification Method Select */}
              <div className="space-y-1.5">
                <label
                  htmlFor="verificationMethod"
                  className="block text-xs font-bold text-gray-800"
                >
                  Verification Method <span className="text-red-500">*</span>
                </label>
                <select
                  id="verificationMethod"
                  value={verificationMethod}
                  onChange={(e) => setVerificationMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all"
                  required
                >
                  <option value="Device Unlocked">Device Unlocked</option>
                  <option value="Hidden Identifying Marks">Hidden Identifying Marks</option>
                  <option value="Visual/Photo Match">Visual/Photo Match</option>
                  <option value="Student ID / Receipt">Student ID / Receipt</option>
                </select>
                <p className="text-[11px] text-gray-400">
                  Select the physical verification method used during the handover.
                </p>
              </div>

              {/* Verification Notes Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="verificationNotes"
                    className="block text-xs font-bold text-gray-800"
                  >
                    Verification Notes <span className="text-red-500">* (Required)</span>
                  </label>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Permanent audit record
                  </span>
                </div>
                <textarea
                  id="verificationNotes"
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Provide details on how identity or item ownership was confirmed before return..."
                  rows={3}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={Boolean(actionLoading) || confirmLoading}
                  className="px-4 py-2.5 bg-white text-gray-700 font-bold text-xs rounded-xl border border-gray-200 hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(actionLoading) || !verificationNotes.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-100 active:scale-[0.98]"
                >
                  <CheckCircle className="w-4 h-4" />
                  {actionLoading ? 'Processing Return...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generic Confirmation Modal */}
      {isConfirmModalOpen && confirmActionDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    confirmActionDetails.confirmVariant === 'danger'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-emerald-100 text-emerald-600'
                  }`}
                >
                  {confirmActionDetails.confirmVariant === 'danger' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  {confirmActionDetails.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeConfirmModal}
                disabled={confirmLoading}
                className="p-1.5 hover:bg-gray-200/60 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 leading-relaxed font-medium">
                {confirmActionDetails.message}
              </p>

              {confirmActionDetails.actionType === 'deny_claim' && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1.5">
                      Reason for Denial <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[
                        'Mismatched details',
                        'Invalid Proof',
                        'Unverified Ownership',
                        'Other',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setDenyReason(preset === 'Other' ? '' : preset)}
                          className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all ${
                            denyReason === preset
                              ? 'bg-red-50 border-red-300 text-red-700 font-bold'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={denyReason}
                      onChange={(e) => setDenyReason(e.target.value)}
                      placeholder="Please provide a clear reason for denying this claim (required)..."
                      rows={3}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-red-500/20 focus:border-red-600 outline-none transition-all resize-none"
                    />
                    <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={preventResubmit}
                        onChange={(e) => setPreventResubmit(e.target.checked)}
                        className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-gray-700">
                        Prevent user from resubmitting (Permanent Rejection)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeConfirmModal}
                  disabled={confirmLoading}
                  className="px-4 py-2.5 bg-white text-gray-700 font-bold text-xs rounded-xl border border-gray-200 hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {confirmActionDetails.cancelText || 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteConfirm}
                  disabled={
                    confirmLoading ||
                    (confirmActionDetails.actionType === 'deny_claim' && !denyReason.trim())
                  }
                  className={`inline-flex items-center gap-2 px-5 py-2.5 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                    confirmActionDetails.confirmVariant === 'danger'
                      ? 'bg-red-600 hover:bg-red-700 shadow-red-100'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
                  }`}
                >
                  {confirmLoading && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {confirmActionDetails.confirmText || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
