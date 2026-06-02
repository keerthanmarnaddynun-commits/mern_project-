import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Tag,
  Mail,
  Phone,
  CheckCircle,
  AlertCircle,
  Trash2,
  Clock,
  Sparkles,
  ArrowRight,
  Handshake,
  Edit2,
  Info,
  PlusCircle,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { fetchItemById, deleteItem, getSimilarItems, createClaim, getClaimStatus, updateItem, getMyReports, createManualClaim } from '../services/api';
import type { ClaimStatusResponse, Item, SimilarItemMatch } from '../types';
import { CATEGORIES } from '../types';
import { useAuth } from '../context/AuthContext';
import { CUSTODY_LOCATIONS } from '../constants/custodyLocations';

export default function ItemDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const previousMatchId = location.state?.previousMatchId;
  const { user } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [similarMatches, setSimilarMatches] = useState<SimilarItemMatch[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimSubmitted, setClaimSubmitted] = useState(false);
  const [claimNoRetry, setClaimNoRetry] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claimStatus, setClaimStatus] = useState<ClaimStatusResponse | null>(null);
  const [claimStatusLoading, setClaimStatusLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    category: '',
    location: '',
    date_occurred: '',
    image_url: '',
    contact_email: '',
    contact_phone: '',
    custodyLocation: '',
    custodyDepartment: '',
    receiverName: '',
    receiverRole: '',
    handoverNotes: '',
  });

  // Manual Review State
  const [showManualModal, setShowManualModal] = useState(false);
  const [userPendingLostItems, setUserPendingLostItems] = useState<Item[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSelectedLost, setManualSelectedLost] = useState('');
  const [manualReasonType, setManualReasonType] = useState('');
  const [manualReasonText, setManualReasonText] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualSuccess, setManualSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setSimilarLoading(false);
      setError('');
      setSimilarError('');
      setSimilarMatches([]);
      setClaimSubmitted(false);
      setClaimNoRetry(false);
      setClaimError('');
      setClaimStatus(null);
      setClaimStatusLoading(false);

      let data: Item | null = null;
      try {
        data = await fetchItemById(id);
        if (cancelled) return;
        setItem(data);
      } catch {
        if (!cancelled) {
          setError('Failed to load item details');
          setItem(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (!data || cancelled) return;

      setSimilarLoading(true);
      try {
        const { matches } = await getSimilarItems(data._id);
        if (!cancelled) {
          const validMatches = Array.isArray(matches) ? matches : [];
          setSimilarMatches(
            previousMatchId
              ? validMatches.filter((m) => m.item._id !== previousMatchId)
              : validMatches
          );
        }
      } catch {
        if (!cancelled) {
          setSimilarError('Could not load possible matches. You can still view this item.');
          setSimilarMatches([]);
        }
      } finally {
        if (!cancelled) setSimilarLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!item || item.type !== 'found' || !user) {
      setClaimStatus(null);
      setClaimStatusLoading(false);
      return;
    }
    if (String(user._id) === String(item.postedBy)) {
      setClaimStatus(null);
      setClaimStatusLoading(false);
      return;
    }

    let cancelled = false;
    setClaimStatusLoading(true);
    getClaimStatus(item._id)
      .then((s) => {
        if (!cancelled) {
          setClaimStatus(s);
          setClaimError('');
          if (s.hasClaimed) setClaimNoRetry(false);
          setClaimStatusLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClaimStatusLoading(false);
          setClaimStatus(null);
        }
      });

    // Also fetch lost items early for manual review check
    getMyReports().then(reports => {
      if (!cancelled) {
        const pendingLost = reports.filter(r => r.type === 'lost' && r.status === 'pending');
        setUserPendingLostItems(pendingLost);
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [item, user]);

  const handleOpenEdit = () => {
    if (!item) return;
    setEditData({
      title: item.title,
      description: item.description,
      category: item.category,
      location: item.location,
      date_occurred: new Date(item.date_occurred).toISOString().split('T')[0],
      image_url: item.image_url || '',
      contact_email: item.contact_email,
      contact_phone: item.contact_phone || '',
      custodyLocation: item.custodyLocation || '',
      custodyDepartment: item.custodyDepartment || '',
      receiverName: item.receiverName || '',
      receiverRole: item.receiverRole || '',
      handoverNotes: item.handoverNotes || '',
    });
    setEditError('');
    setEditSuccess(false);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setEditLoading(true);
    setEditError('');
    try {
      const updated = await updateItem(item._id, {
        ...editData,
        image_url: editData.image_url || null,
        contact_phone: editData.contact_phone || null,
        custodyLocation: item.type === 'found' ? editData.custodyLocation || null : null,
        custodyDepartment: item.type === 'found' ? editData.custodyDepartment || null : null,
        receiverName: item.type === 'found' ? editData.receiverName || null : null,
        receiverRole: item.type === 'found' ? editData.receiverRole || null : null,
        handoverNotes: item.type === 'found' ? editData.handoverNotes || null : null,
      });
      setItem(updated);
      setEditSuccess(true);
      setTimeout(() => {
        setShowEditModal(false);
        setEditSuccess(false);
      }, 1500);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setEditError(err.response?.data?.message || 'Failed to update item');
      } else {
        setEditError(err instanceof Error ? err.message : 'Failed to update item');
      }
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    setActionLoading(true);
    try {
      await deleteItem(item._id);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
      setActionLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!item) return;
    setClaimError('');
    const token = localStorage.getItem('token');
    if (!user || !token) {
      navigate('/login', {
        replace: false,
        state: { sessionMessage: 'Please sign in to submit a claim.' },
      });
      return;
    }
    setClaimSubmitting(true);
    try {
      await createClaim(item._id);
      setClaimError('');
      setClaimSubmitted(true);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const msg = (err.response?.data as { message?: string } | undefined)?.message;
        if (status === 409) {
          setClaimNoRetry(true);
          setClaimError(msg || 'You have already submitted a claim for this item.');
        } else if (status === 403) {
          const raw = msg || '';
          if (raw.toLowerCase().includes('matching')) {
            setClaimError('Report a matching lost item before claiming this item.');
            setClaimNoRetry(false);
          } else {
            setClaimError(raw || 'You cannot perform this action.');
            setClaimNoRetry(true);
          }
        } else if (status === 401) {
          setClaimError('Please sign in again to submit a claim.');
          navigate('/login', { state: { sessionMessage: 'Your session expired. Please sign in again.' } });
        } else if (status === 400) {
          setClaimError(msg || 'This item cannot be claimed.');
          setClaimNoRetry(true);
        } else if (status === 404) {
          setClaimError(msg || 'Item not found.');
        } else {
          setClaimError(msg || 'Could not submit claim. Try again later.');
        }
      } else {
        setClaimError('Could not submit claim. Try again later.');
      }
    } finally {
      setClaimSubmitting(false);
      if (item?.type === 'found' && user && localStorage.getItem('token')) {
        try {
          const s = await getClaimStatus(item._id);
          setClaimStatus(s);
          if (s.hasClaimed) {
            setClaimNoRetry(false);
            setClaimSubmitted(false);
            setClaimError('');
          }
        } catch {
          /* keep prior claimStatus */
        }
      }
    }
  };

  const handleOpenManualModal = async () => {
    setManualError('');
    setManualSuccess(false);
    setManualLoading(true);
    setShowManualModal(true);
    try {
      const items = await getMyReports();
      const pendingLost = items.filter(i => i.type === 'lost' && i.status === 'pending');
      setUserPendingLostItems(pendingLost);
      if (pendingLost.length > 0) {
        setManualSelectedLost(pendingLost[0]._id);
      }
    } catch (err) {
      setManualError('Could not load your lost items.');
    } finally {
      setManualLoading(false);
    }
  };

  const handleSubmitManualClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !manualSelectedLost || !manualReasonType) return;
    
    setManualError('');
    setManualLoading(true);
    try {
      await createManualClaim(item._id, {
        lostItemId: manualSelectedLost,
        reasonType: manualReasonType,
        reasonText: manualReasonType === 'other' ? manualReasonText : ''
      });
      setClaimSubmitted(true);
      setClaimNoRetry(true);
      setClaimStatus(prev => prev ? { ...prev, hasClaimed: true, canClaim: false } : null);
      setManualSuccess(true);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setManualError(err.response?.data?.message || 'Could not submit manual claim.');
      } else {
        setManualError('An unexpected error occurred.');
      }
    } finally {
      setManualLoading(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  function confidenceBadgeClass(confidence: string): string {
    switch (confidence) {
      case 'Extremely Strong Match':
        return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
      case 'Very Strong Match':
        return 'bg-blue-50 text-blue-800 border border-blue-200';
      case 'Strong Match':
        return 'bg-amber-50 text-amber-900 border border-amber-200';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-10 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-24 mb-8" />
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="h-72 bg-gray-200" />
            <div className="p-8 space-y-4">
              <div className="h-6 bg-gray-200 rounded w-2/3" />
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-4/5" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Item not found</h2>
          <p className="text-gray-400 text-sm mb-6">This item may have been removed or resolved.</p>
          <Link to="/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user != null && String(user._id) === String(item.postedBy);
  const isLost = item.type === 'lost';
  const itemIsPending = item.status === 'pending' && !item.is_resolved;
  const showClaimCta =
    user != null &&
    !isOwner &&
    itemIsPending &&
    !isLost &&
    claimStatus?.canClaim === true &&
    !claimStatusLoading &&
    !claimNoRetry;

  const claimSuccessBanner = claimStatus?.hasClaimed === true || claimSubmitted;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to all items
          </Link>
          
          {previousMatchId && (
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              Arrived from a related item
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {(item.status === 'resolved' || item.is_resolved) && (
          <div className="mb-4 flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
            <CheckCircle className="w-4 h-4" />
            Item marked as resolved
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.title}
              className="w-full h-72 object-cover"
            />
          ) : (
            <div className="w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <Tag className="w-16 h-16 text-gray-300" />
            </div>
          )}

          <div className="p-8">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                    isLost
                      ? 'bg-red-100 text-red-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {isLost ? 'Lost' : 'Found'}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {item.category}
                </span>
                {item.status === 'pending' ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-red-100 text-red-700">
                    Status: Pending
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700">
                    Status: Resolved
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                Posted {formatDateTime(item.createdAt)}
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">{item.title}</h1>
            <p className="text-gray-600 leading-relaxed mb-6">{item.description}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Location</p>
                  <p className="text-sm font-medium text-gray-800">{item.location}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Date {isLost ? 'lost' : 'found'}</p>
                  <p className="text-sm font-medium text-gray-800">{formatDate(item.date_occurred)}</p>
                </div>
              </div>
            </div>

            {!isLost && (
              <div className="border-t border-gray-100 pt-6 mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Item Custody Details</h3>
                {item.custodyStatus === 'department_received' ? (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                      Department Received
                    </span>
                    <p className="text-sm text-gray-800">
                      <span className="font-semibold">Currently held at:</span>{' '}
                      {item.custodyLocation || item.custodyDepartment || 'Department desk'}
                      {item.custodyDepartment && item.custodyLocation ? ` (${item.custodyDepartment})` : ''}
                    </p>
                    {item.receiverName && (
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">Received by:</span> {item.receiverName}
                      </p>
                    )}
                    {item.receiverRole && (
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">Role:</span> {item.receiverRole}
                      </p>
                    )}
                    {item.handoverNotes && (
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">Handover notes:</span> {item.handoverNotes}
                      </p>
                    )}
                    {item.handoverDate && (
                      <p className="text-xs text-gray-500">
                        Handover date: {new Date(item.handoverDate).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : item.custodyStatus === 'returned' ? (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 mb-2">
                      Returned
                    </span>
                    <p className="text-sm text-emerald-900">This item has been returned to its owner.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 mb-2">
                      Not Handed Over
                    </span>
                    <p className="text-sm text-gray-700">
                      This found item has not been marked as handed over to a department yet.
                    </p>
                  </div>
                )}
              </div>
            )}

            {isLost ? (
              <div className="border-t border-gray-100 pt-6">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Reporter contact</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={`mailto:${item.contact_email}`}
                    className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 text-sm font-medium rounded-xl transition-colors flex-1 justify-center"
                  >
                    <Mail className="w-4 h-4 text-gray-500" />
                    {item.contact_email}
                  </a>
                  {item.contact_phone && (
                    <a
                      href={`tel:${item.contact_phone}`}
                      className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 text-sm font-medium rounded-xl transition-colors flex-1 justify-center"
                    >
                      <Phone className="w-4 h-4 text-gray-500" />
                      {item.contact_phone}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-t border-gray-100 pt-6">
                {itemIsPending && user && !isOwner && (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900">Think this item belongs to you?</h3>
                    <p className="text-xs text-gray-500 mt-1.5 mb-4 max-w-lg leading-relaxed">
                      You can claim this item if you have reported a matching lost item.
                    </p>
                    {item.custodyStatus === 'department_received' && (
                      <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-4 max-w-lg">
                        If your claim is approved, you may collect this item from the listed department/location after
                        verification.
                      </p>
                    )}

                    {claimStatusLoading && (
                      <p className="text-xs text-gray-400 mb-4 flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                        Checking claim eligibility…
                      </p>
                    )}

                    {!claimStatusLoading &&
                      claimStatus &&
                      !claimStatus.hasClaimed &&
                      !claimStatus.canClaim &&
                      claimStatus.reason && (
                        <div className="mb-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm leading-relaxed">
                          {claimStatus.reason}
                        </div>
                      )}

                    {claimSuccessBanner && (
                      <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-sm font-medium mb-4">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        {claimStatus?.hasClaimed ? 'Claim already submitted' : 'Claim Submitted'}
                      </div>
                    )}

                    {claimError && (
                      <div className="mb-4 flex items-center gap-2 p-3.5 bg-amber-50 border border-amber-100 rounded-xl text-amber-900 text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {claimError}
                      </div>
                    )}

                    {showClaimCta && (
                      <button
                        type="button"
                        onClick={handleClaim}
                        disabled={claimSubmitting || !claimStatus?.canClaim}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-sm transition-colors mb-5"
                      >
                        {claimSubmitting ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Submitting…
                          </>
                        ) : (
                          <>
                            <Handshake className="w-4 h-4" />
                            Claim this item
                          </>
                        )}
                      </button>
                    )}

                    {user != null && !isOwner && itemIsPending && !isLost && !claimStatusLoading && claimStatus && !claimStatus.canClaim && !claimStatus.hasClaimed && !claimSubmitted && (
                      <div className="mt-6 border-t border-gray-100 pt-6">
                        {userPendingLostItems.length > 0 ? (
                          <>
                            <h4 className="text-sm font-bold text-gray-800 mb-2">Think this may still be your item?</h4>
                            <p className="text-xs text-gray-500 mb-4 max-w-lg leading-relaxed">
                              If the automatic system didn't match your lost report due to differing categories or descriptions, you can request a manual review by an admin.
                            </p>
                            <button
                              type="button"
                              onClick={handleOpenManualModal}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 hover:bg-amber-200 text-sm font-semibold rounded-lg shadow-sm transition-colors"
                            >
                              Request Manual Review
                            </button>
                          </>
                        ) : (
                          <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                                <Info className="w-5 h-5" />
                              </div>
                              <h4 className="text-base font-bold text-gray-900">Want to request a manual review?</h4>
                            </div>
                            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                              You currently don’t have any active lost item reports. To request a manual review, first create a lost item report that may match this found item.
                            </p>
                            <button
                              onClick={() => navigate('/post', { state: { prefillCategory: item.category, prefillType: 'lost' } })}
                              className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-amber-100"
                            >
                              <PlusCircle className="w-4 h-4" />
                              Report Lost Item
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {itemIsPending && user && isOwner && (
                  <p className="text-xs text-gray-600 mb-5">
                    You posted this found item. Others can claim it only if they have a matching lost report.
                  </p>
                )}

                {itemIsPending && !user && (
                  <p className="text-sm text-gray-600 mb-5">
                    <Link to="/login" className="text-blue-600 font-medium hover:text-blue-700">
                      Sign in
                    </Link>{' '}
                    to claim this item if you have a matching lost listing.
                  </p>
                )}

                {!itemIsPending && (
                  <p className="text-xs text-gray-500 mb-5">Claims are not available for resolved listings.</p>
                )}

                <div className="border-t border-gray-100 pt-5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Reporter contact</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={`mailto:${item.contact_email}`}
                      className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 text-sm font-medium rounded-xl transition-colors flex-1 justify-center"
                    >
                      <Mail className="w-4 h-4 text-gray-500" />
                      {item.contact_email}
                    </a>
                    {item.contact_phone && (
                      <a
                        href={`tel:${item.contact_phone}`}
                        className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 text-sm font-medium rounded-xl transition-colors flex-1 justify-center"
                      >
                        <Phone className="w-4 h-4 text-gray-500" />
                        {item.contact_phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isOwner && item.status === 'pending' && !item.is_resolved && (
              <div className="border-t border-gray-100 pt-6 mt-6">
                <p className="text-xs text-gray-400 mb-3">Owner actions</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleOpenEdit}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-xl transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Item
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Item
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {isOwner && (
          <section className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8" aria-labelledby="possible-matches-heading">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 id="possible-matches-heading" className="text-lg font-bold text-gray-900">
                Possible Matches
              </h2>
              <p
                className={`mt-1.5 text-sm font-semibold rounded-lg px-3 py-1.5 inline-block ${
                  isLost ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
                }`}
              >
                {isLost ? 'Similar FOUND items' : 'Similar LOST items'}
              </p>
              <p className="text-sm text-gray-600 mt-2 max-w-xl leading-relaxed">
                Possible related lost/found items based on similar details.
              </p>
            </div>
          </div>

          {similarLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Loading possible matches…
            </div>
          )}

          {!similarLoading && similarError && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-sm mb-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {similarError}
            </div>
          )}

          {!similarLoading && !similarError && similarMatches.length === 0 && (
            <p className="text-sm text-gray-500 py-2">No similar lost/found items found yet.</p>
          )}

          {!similarLoading && similarMatches.length > 0 && (
            <ul className="space-y-3 mt-4">
              {similarMatches.map(({ item: m, confidence }) => {
                const mLost = m.type === 'lost';
                const isMatchOwner = user ? user._id === m.postedBy : false;
                return (
                  <li
                    key={m._id}
                    className={`border rounded-xl p-4 sm:p-5 transition-all ${
                      isMatchOwner
                        ? 'bg-indigo-50/60 border-indigo-200 border-l-4 border-l-indigo-500 shadow-md shadow-indigo-100/50 hover:border-indigo-300 hover:shadow-lg'
                        : 'border-gray-100 bg-gray-50/60 hover:bg-white hover:border-gray-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 text-base leading-snug">{m.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${
                              mLost ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {mLost ? 'Lost' : 'Found'}
                          </span>
                          <span className="text-xs text-gray-600 bg-white border border-gray-200 rounded-full px-2.5 py-0.5 font-medium">
                            {m.category}
                          </span>
                          <span
                            className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${confidenceBadgeClass(confidence)}`}
                          >
                            {confidence}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 mt-3 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                          <span className="leading-snug">{m.location}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2.5">
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            Similar keywords and item details detected.
                          </p>
                          {isMatchOwner && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md shadow-sm">
                              Your report
                            </span>
                          )}
                        </div>
                      </div>
                      <Link
                        to={`/item/${m._id}`}
                        state={{ previousMatchId: item?._id }}
                        className="inline-flex items-center justify-center gap-1.5 self-start sm:self-center shrink-0 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
                      >
                        View item
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          </section>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete item?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete this item? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {actionLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-2xl w-full shadow-xl my-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Edit Item</h3>
            
            {editError && (
              <div className="mb-6 flex items-center gap-2 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {editError}
              </div>
            )}
            
            {editSuccess && (
              <div className="mb-6 flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                Item updated successfully!
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    required
                    value={editData.category}
                    onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editData.date_occurred}
                    onChange={(e) => setEditData({ ...editData, date_occurred: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  required
                  value={editData.location}
                  onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (Optional)</label>
                <input
                  type="url"
                  value={editData.image_url}
                  onChange={(e) => setEditData({ ...editData, image_url: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    required
                    value={editData.contact_email}
                    onChange={(e) => setEditData({ ...editData, contact_email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone (Optional)</label>
                  <input
                    type="tel"
                    value={editData.contact_phone}
                    onChange={(e) => setEditData({ ...editData, contact_phone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {item.type === 'found' && (
                <div className="border-t border-gray-100 pt-5 mt-2">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1.5">Item Handover Details</h4>
                  <p className="text-xs text-blue-700/80 mb-4">
                    Update where this found item is currently kept so claimants know where to collect it.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Custody Location / Department</label>
                      <select
                        value={editData.custodyLocation}
                        onChange={(e) => setEditData({ ...editData, custodyLocation: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      >
                        <option value="">Select location (optional)</option>
                        {CUSTODY_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                      <input
                        type="text"
                        value={editData.custodyDepartment}
                        onChange={(e) => setEditData({ ...editData, custodyDepartment: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Name</label>
                      <input
                        type="text"
                        value={editData.receiverName}
                        onChange={(e) => setEditData({ ...editData, receiverName: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Role / Designation</label>
                      <input
                        type="text"
                        value={editData.receiverRole}
                        onChange={(e) => setEditData({ ...editData, receiverRole: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Handover Notes</label>
                      <textarea
                        rows={3}
                        value={editData.handoverNotes}
                        onChange={(e) => setEditData({ ...editData, handoverNotes: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={editLoading}
                  className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-xl my-8">
            {manualSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Request Submitted</h3>
                <p className="text-sm text-gray-500 mb-6 px-4">
                  Manual review submitted successfully.
                </p>
                <button
                  onClick={() => setShowManualModal(false)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Request Manual Review</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Submit this item for manual review by an administrator. Please select your matching lost item and explain why you believe it matches.
                </p>

                {manualError && (
                  <div className="mb-6 flex items-center gap-2 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {manualError}
                  </div>
                )}

                <form onSubmit={handleSubmitManualClaim} className="space-y-4 text-left">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Which exact lost item are you linking this found item to?</label>
                    <p className="text-xs text-gray-500 mb-3">Choose the lost report that best matches this found item.</p>
                    {userPendingLostItems.length === 0 && !manualLoading ? (
                      <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
                        You have no pending lost items. Please report a lost item first.
                      </p>
                    ) : userPendingLostItems.length === 1 && !manualLoading ? (
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <Tag className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-tight">{userPendingLostItems[0].title}</p>
                          <p className="text-xs text-gray-600 mt-1">{userPendingLostItems[0].category} • {formatDate(userPendingLostItems[0].date_occurred)}</p>
                        </div>
                      </div>
                    ) : (
                      <select
                        required
                        disabled={manualLoading}
                        value={manualSelectedLost}
                        onChange={(e) => setManualSelectedLost(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      >
                        <option value="" disabled>Select a lost report...</option>
                        {userPendingLostItems.map(item => (
                          <option key={item._id} value={item._id}>
                            {item.title} ({item.category})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason for manual review</label>
                    <select
                      required
                      disabled={manualLoading || userPendingLostItems.length === 0}
                      value={manualReasonType}
                      onChange={(e) => setManualReasonType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="" disabled>Select reason...</option>
                      <option value="wrong_category">Wrong category selected</option>
                      <option value="wording_difference">Different wording/title</option>
                      <option value="location_mismatch">Location mismatch but details match</option>
                      <option value="similar_appearance">Similar appearance/details</option>
                      <option value="system_missed_match">System may have missed the match</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {manualReasonType === 'other' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Please specify</label>
                      <textarea
                        required
                        disabled={manualLoading}
                        rows={3}
                        value={manualReasonText}
                        onChange={(e) => setManualReasonText(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                        placeholder="Provide additional details..."
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowManualModal(false)}
                      disabled={manualLoading}
                      className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={manualLoading || userPendingLostItems.length === 0}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-xl transition-colors"
                    >
                      {manualLoading ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
