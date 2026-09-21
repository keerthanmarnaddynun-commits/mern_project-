import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  PlusCircle, 
  Filter, 
  SlidersHorizontal, 
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
  Tag,
  Handshake,
  AlertTriangle,
  ExternalLink,
  X
} from 'lucide-react';
import Navbar from '../components/Navbar';
import ItemCard from '../components/ItemCard';
import { useAuth } from '../context/AuthContext';
import { fetchItems, getRecentlyReturned, disputeItemHandover } from '../services/api';
import type { Item, ItemType } from '../types';
import { CATEGORIES } from '../types';

type FilterType = 'all' | ItemType | 'returned';

interface ReturnedClaim {
  _id: string;
  status: string;
  updatedAt: string;
  claimant?: {
    name?: string;
    email?: string;
  };
  itemId?: Item;
  lostItemId?: Item;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [returnedClaims, setReturnedClaims] = useState<ReturnedClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Dispute modal state
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [disputingClaim, setDisputingClaim] = useState<ReturnedClaim | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeProofUrl, setDisputeProofUrl] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeError, setDisputeError] = useState('');

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        if (typeFilter === 'returned') {
          const data = await getRecentlyReturned();
          setReturnedClaims(Array.isArray(data) ? data : []);
        } else {
          const data = await fetchItems(typeFilter === 'all' ? undefined : typeFilter);
          setItems(data);
        }
      } catch {
        setError(typeFilter === 'returned' ? 'Failed to load recently returned items' : 'Failed to load items');
        if (typeFilter === 'returned') {
          setReturnedClaims([]);
        } else {
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [typeFilter]);

  const filtered = items.filter((item) => {
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesSearch =
      search === '' ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.location.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredReturned = returnedClaims.filter((claim) => {
    const itm = claim.itemId;
    const matchesCategory = categoryFilter === 'All' || itm?.category === categoryFilter;
    const matchesSearch =
      search === '' ||
      Boolean(itm?.title?.toLowerCase().includes(search.toLowerCase())) ||
      Boolean(itm?.description?.toLowerCase().includes(search.toLowerCase())) ||
      Boolean(itm?.location?.toLowerCase().includes(search.toLowerCase())) ||
      Boolean(claim.claimant?.name?.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleOpenDisputeModal = (claim: ReturnedClaim) => {
    setDisputingClaim(claim);
    setDisputeReason('');
    setDisputeProofUrl('');
    setDisputeError('');
    setIsDisputeModalOpen(true);
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputingClaim?.itemId?._id) return;

    if (!disputeReason.trim()) {
      setDisputeError('Please provide a reason for the dispute.');
      return;
    }

    setDisputeLoading(true);
    setDisputeError('');

    try {
      await disputeItemHandover(disputingClaim.itemId._id, {
        reason: disputeReason.trim(),
        proofUrl: disputeProofUrl.trim(),
      });

      // Update state in-place so card immediately reflects the dispute
      setReturnedClaims((prev) =>
        prev.map((c) =>
          c._id === disputingClaim._id && c.itemId
            ? {
                ...c,
                itemId: {
                  ...c.itemId,
                  isDisputed: true,
                  disputeReason: disputeReason.trim(),
                  disputeProofUrl: disputeProofUrl.trim(),
                },
              }
            : c
        )
      );

      setToast('Dispute submitted successfully. An administrator will review this case.');
      setIsDisputeModalOpen(false);
      setDisputingClaim(null);
      setDisputeReason('');
      setDisputeProofUrl('');
    } catch (err: any) {
      setDisputeError(err?.response?.data?.message || 'Could not submit dispute.');
    } finally {
      setDisputeLoading(false);
    }
  };

  const lostCount = items.filter((i) => i.type === 'lost').length;
  const foundCount = items.filter((i) => i.type === 'found').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold mb-2">Lost & Found Board</h1>
            <p className="text-blue-100 mb-6">
              Browse reported items or post your own. Help reconnect people with their belongings.
            </p>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by item, location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white text-gray-900 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-sm"
              />
            </div>
          </div>

          <div className="flex gap-6 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/20">
              <div className="text-2xl font-bold">{items.length}</div>
              <div className="text-blue-100 text-xs mt-0.5">Total items</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/20">
              <div className="text-2xl font-bold text-red-300">{lostCount}</div>
              <div className="text-blue-100 text-xs mt-0.5">Lost</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/20">
              <div className="text-2xl font-bold text-emerald-300">{foundCount}</div>
              <div className="text-blue-100 text-xs mt-0.5">Found</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Community Activity CTA */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Community Activity</h2>
            <p className="text-gray-500 leading-relaxed max-w-2xl">
              See how the community is helping recover lost items with live statistics and insights.
            </p>
          </div>
          <Link
            to="/community-activity"
            className="whitespace-nowrap px-8 py-4 bg-blue-600 text-white hover:bg-blue-700 font-bold rounded-2xl text-sm transition-all shadow-xl shadow-blue-100 active:scale-[0.98]"
          >
            Explore Activity
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'lost', 'found', 'returned'] as FilterType[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  typeFilter === t
                    ? t === 'lost'
                      ? 'bg-red-100 text-red-700 border border-red-200'
                      : t === 'found'
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : t === 'returned'
                      ? 'bg-emerald-800 text-white border border-emerald-800 shadow-xs'
                      : 'bg-blue-600 text-white border border-blue-600'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {t === 'all'
                  ? 'All items'
                  : t === 'returned'
                  ? 'Recently Returned'
                  : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg border transition-colors ${
                showFilters || categoryFilter !== 'All'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filter
              {categoryFilter !== 'All' && (
                <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">1</span>
              )}
            </button>
            <Link
              to="/post"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              Report Item
            </Link>
          </div>
        </div>

        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filter by category</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {['All', ...CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    categoryFilter === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm mb-4">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-44 bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : typeFilter === 'returned' ? (
          filteredReturned.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 p-8 shadow-xs">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-700 mb-1">No recently returned items</h3>
              <p className="text-gray-400 text-sm max-w-md mx-auto">
                No items have been marked as returned within the last 48 hours. Items returned by faculty appear here automatically.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <p className="text-sm text-gray-500">
                  Showing {filteredReturned.length} recently returned {filteredReturned.length === 1 ? 'item' : 'items'} in the last 48 hours
                  {categoryFilter !== 'All' && ` in ${categoryFilter}`}
                  {search && ` matching "${search}"`}
                </p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 w-fit">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  48-Hour Public Audit Ledger
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredReturned.map((claim) => {
                  const itemReporterId = (claim.itemId?.postedBy as any)?._id || claim.itemId?.postedBy;
                  const isOriginalReporter = Boolean(user?._id && itemReporterId && String(user._id) === String(itemReporterId));
                  const isItemDisputed = Boolean(claim.itemId?.isDisputed);

                  return (
                    <div
                      key={claim._id}
                      className="bg-emerald-50/40 border border-emerald-200/80 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-emerald-300 transition-all"
                    >
                      <div>
                        {/* Card Header: Badge & Timestamp */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Returned
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {new Date(claim.updatedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>

                        {/* Found Item Title & Details */}
                        <h3 className="text-base font-bold text-gray-900 leading-snug mb-2 line-clamp-1">
                          {claim.itemId?.title || 'Unknown Item'}
                        </h3>

                        {claim.itemId?.description && (
                          <p className="text-xs text-gray-600 line-clamp-2 mb-3">
                            {claim.itemId.description}
                          </p>
                        )}

                        <div className="space-y-1.5 text-xs text-gray-600 bg-white/90 p-3 rounded-xl border border-emerald-100 mb-4">
                          {claim.itemId?.category && (
                            <div className="flex items-center gap-2">
                              <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span>Category: <strong className="text-gray-700">{claim.itemId.category}</strong></span>
                            </div>
                          )}
                          {claim.itemId?.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span>Found at: {claim.itemId.location}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-emerald-900 font-semibold pt-1.5 border-t border-emerald-100">
                            <Handshake className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>
                              Returned to {claim.claimant?.name || 'Claimant'} on {new Date(claim.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="pt-3 border-t border-emerald-200/60 flex items-center justify-between gap-2">
                        {claim.itemId?._id ? (
                          <Link
                            to={`/item/${claim.itemId._id}`}
                            className="text-xs font-semibold text-gray-700 hover:text-emerald-700 transition-colors flex items-center gap-1"
                          >
                            View Details <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Item record archived</span>
                        )}

                        {isItemDisputed ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-800 border border-red-300 font-bold text-xs rounded-xl shadow-xs">
                            🚨 Handover Disputed
                          </span>
                        ) : (
                          !isOriginalReporter && (
                            <button
                              type="button"
                              onClick={() => handleOpenDisputeModal(claim)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-700 hover:text-amber-800 border border-amber-200 hover:border-amber-300 font-medium text-xs rounded-xl transition-all active:scale-[0.98] shadow-2xs"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              Dispute Handover
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No items found</h3>
            <p className="text-gray-400 text-sm mb-6">Try adjusting your filters or search query</p>
            <Link
              to="/post"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Be the first to report
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Showing {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
              {categoryFilter !== 'All' && ` in ${categoryFilter}`}
              {search && ` matching "${search}"`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((item) => (
                <ItemCard key={item._id} item={item} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Dispute Confirmation Modal */}
      {isDisputeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-xl my-8">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Dispute Item Handover</h3>
            <p className="text-sm text-gray-500 mb-6">
              If you believe {disputingClaim?.itemId?.title ? `"${disputingClaim.itemId.title}"` : 'this item'} was given to the wrong person, please provide proof of ownership so the Admin can investigate.
            </p>

            {disputeError && (
              <div className="mb-6 flex items-center gap-2 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {disputeError}
              </div>
            )}

            <form onSubmit={handleSubmitDispute} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for dispute <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  disabled={disputeLoading}
                  rows={4}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none"
                  placeholder="Explain why you are the rightful owner and contest this handover..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proof URL (e.g., Google Drive link to receipt, serial number, or photo)
                </label>
                <input
                  type="url"
                  disabled={disputeLoading}
                  value={disputeProofUrl}
                  onChange={(e) => setDisputeProofUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  placeholder="https://drive.google.com/..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsDisputeModalOpen(false);
                    setDisputeError('');
                    setDisputingClaim(null);
                  }}
                  disabled={disputeLoading}
                  className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeLoading || !disputeReason.trim()}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                >
                  {disputeLoading ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-[110] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 border bg-amber-50 border-amber-200 text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-xs font-bold">{toast}</p>
          <button
            onClick={() => setToast(null)}
            className="p-1 hover:bg-black/5 rounded-lg transition-colors ml-2"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}
    </div>
  );
}
