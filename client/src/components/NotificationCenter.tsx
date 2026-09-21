import { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Info, 
  ChevronRight, 
  ShieldCheck,
  User,
  X,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getReceivedClaims, getMyClaims, getMyReports, getUserNotifications } from '../services/api';
import type { Item } from '../types';

interface Claim {
  _id: string;
  status: string;
  claimType: string;
  createdAt: string;
  updatedAt: string;
  itemId: {
    _id: string;
    title: string;
  };
  lostItemId: {
    _id: string;
    title: string;
  };
  claimant?: {
    name: string;
  };
  reason?: string;
  reasonText?: string;
}

interface Notification {
  id: string;
  type: 'received' | 'submitted' | 'item_verified' | 'handover_denied' | 'claim_rejected' | 'dispute_resolved' | 'item_recovered' | string;
  status: string;
  message: string;
  timestamp: string;
  claim?: Claim;
  itemTitle?: string;
  itemId?: string;
  reason?: string;
}

export default function NotificationCenter({ 
  receivedClaims: initialReceived = [], 
  myClaims: initialMy = [] 
}: { 
  receivedClaims?: Claim[], 
  myClaims?: Claim[] 
}) {
  const [receivedClaims, setReceivedClaims] = useState<Claim[]>(initialReceived);
  const [myClaims, setMyClaims] = useState<Claim[]>(initialMy);
  const [myReports, setMyReports] = useState<Item[]>([]);
  const [dbNotifications, setDbNotifications] = useState<any[]>([]);
  const [isListOpen, setIsListOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [seenIds, setSeenIds] = useState<string[]>([]);

  // Load seen IDs on mount
  useEffect(() => {
    const stored = localStorage.getItem('seen_notifications');
    if (stored) {
      try {
        setSeenIds(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse seen notifications', e);
      }
    }
  }, []);

  useEffect(() => {
    // Fetch if no initial data provided (Navbar case)
    if (initialReceived.length === 0 && initialMy.length === 0) {
      const load = async () => {
        try {
          const [received, submitted, reports, directNotifs] = await Promise.all([
            getReceivedClaims(),
            getMyClaims(),
            getMyReports().catch(() => []),
            getUserNotifications().catch(() => []),
          ]);
          setReceivedClaims(received);
          setMyClaims(submitted);
          setMyReports(reports || []);
          setDbNotifications(Array.isArray(directNotifs) ? directNotifs : []);
        } catch (err) {
          console.error('Failed to load notifications', err);
        }
      };
      load();
      const interval = setInterval(load, 120000);
      return () => clearInterval(interval);
    }
  }, [initialReceived.length, initialMy.length]);

  const notifications: Notification[] = [
    ...dbNotifications.map((n: any) => ({
      id: `db-${n._id}`,
      type: (n.type || 'general') as any,
      status: n.type === 'handover_denied' 
        ? 'handover_denied' 
        : n.type === 'item_recovered' 
        ? 'item_verified' 
        : n.type === 'dispute_resolved' 
        ? 'approved' 
        : 'general',
      message: n.message,
      timestamp: n.createdAt,
      itemId: typeof n.itemId === 'string' ? n.itemId : n.itemId?._id,
      itemTitle: typeof n.itemId === 'object' ? n.itemId?.title : n.itemTitle,
    })),
    ...receivedClaims.map(c => ({
      id: `received-${c._id}`,
      type: 'received' as const,
      status: c.status,
      message: c.status === 'pending' 
        ? `Someone submitted a claim for your item "${c.itemId?.title || 'Unknown Item'}"`
        : `A claim for your item "${c.itemId?.title || 'Unknown Item'}" was ${c.status}`,
      timestamp: c.updatedAt || c.createdAt,
      claim: c,
      itemId: typeof c.itemId === 'string' ? c.itemId : c.itemId?._id,
      itemTitle: typeof c.itemId === 'object' ? c.itemId?.title : undefined
    })),
    ...myClaims.map(c => ({
      id: `submitted-${c._id}`,
      type: (c.status === 'rejected' ? 'claim_rejected' : 'submitted') as 'claim_rejected' | 'submitted',
      status: c.status,
      message: `Your claim for "${c.itemId?.title || 'Unknown Item'}" was ${c.status}`,
      timestamp: c.updatedAt || c.createdAt,
      claim: c,
      itemId: typeof c.itemId === 'string' ? c.itemId : c.itemId?._id,
      itemTitle: typeof c.itemId === 'object' ? c.itemId?.title : undefined,
      reason: c.reason || c.reasonText,
    })),
    ...myReports
      .filter((item) => item.type === 'found' && (item.custodyStatus === 'department_received' || item.custodyStatus === 'returned'))
      .map((item) => ({
        id: `verified-${item._id}`,
        type: 'item_verified' as const,
        status: 'item_verified',
        message: `The department has physically received and verified your reported item: ${item.title}.`,
        timestamp: item.updatedAt || item.createdAt || new Date().toISOString(),
        itemTitle: item.title,
        itemId: item._id,
      })),
    ...myReports
      .filter((item) => item.type === 'found' && item.custodyStatus === 'rejected')
      .map((item) => ({
        id: `denied-${item._id}`,
        type: 'handover_denied' as const,
        status: 'handover_denied',
        message: `Handover denied for your reported item: ${item.title}.`,
        timestamp: item.updatedAt || item.createdAt || new Date().toISOString(),
        itemTitle: item.title,
        itemId: item._id,
      }))
  ]
  .filter(n => !(n.type === 'submitted' && n.status === 'pending'))
  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  .slice(0, 15);

  // Stable ID for tracking seen state
  const getStableId = (n: Notification) => `${n.id}-${n.status}-${n.timestamp}`;
  
  const unseenCount = notifications.filter(n => !seenIds.includes(getStableId(n))).length;

  const selectedItemId =
    selectedNotification?.itemId ||
    selectedNotification?.claim?.itemId?._id ||
    (typeof selectedNotification?.claim?.itemId === 'string'
      ? selectedNotification.claim.itemId
      : undefined);

  const handleOpenPanel = () => {
    setIsListOpen(true);
    const currentBatchIds = notifications.map(getStableId);
    const updatedSeenIds = Array.from(new Set([...seenIds, ...currentBatchIds]));
    setSeenIds(updatedSeenIds);
    localStorage.setItem('seen_notifications', JSON.stringify(updatedSeenIds));
  };

  const getIcon = (status: string, type?: string) => {
    switch (type) {
      case 'handover_denied':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case 'item_verified':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'claim_rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        break;
    }
    switch (status) {
      case 'handover_denied':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'approved':
      case 'item_verified':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <>
      {/* Navbar Bell Button */}
      <button
        onClick={handleOpenPanel}
        className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all active:scale-95"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unseenCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white animate-in zoom-in duration-300">
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        )}
      </button>

      {/* Notification List Modal */}
      {isListOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Bell className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
              </div>
              <button 
                onClick={() => setIsListOpen(false)}
                className="p-2 hover:bg-gray-200/50 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="overflow-y-auto divide-y divide-gray-50 flex-1">
              {notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <Bell className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">No recent updates</p>
                </div>
              ) : (
                notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => setSelectedNotification(n)}
                    className="w-full text-left p-5 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex gap-4">
                      <div className={`mt-1 flex-shrink-0 ${n.type === 'handover_denied' ? 'p-1 bg-rose-100 rounded-lg' : ''}`}>
                        {getIcon(n.status, n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 font-semibold leading-snug mb-1.5 group-hover:text-blue-700 transition-colors">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            {new Date(n.timestamp).toLocaleDateString()}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            n.type === 'handover_denied' ? 'bg-rose-100 text-rose-700' :
                            n.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            n.status === 'approved' || n.status === 'item_verified' ? 'bg-emerald-100 text-emerald-700' :
                            n.status === 'rejected' || n.type === 'claim_rejected' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {n.type === 'handover_denied' ? 'Handover Denied' : n.type === 'claim_rejected' ? 'Rejected' : n.status === 'item_verified' ? 'Verified' : n.status}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 self-center group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50/50">
              <Link 
                to="/my-reports?tab=claims" 
                onClick={() => setIsListOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-50 transition-all shadow-sm"
              >
                View Full History in My Reports
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className={`p-6 border-b border-gray-50 ${
              selectedNotification.type === 'handover_denied' ? 'bg-rose-50/70 border-rose-100' :
              selectedNotification.type === 'claim_rejected' || selectedNotification.status === 'rejected' ? 'bg-red-50/50 border-red-100' :
              selectedNotification.status === 'pending' ? 'bg-amber-50/50' :
              selectedNotification.status === 'approved' || selectedNotification.status === 'item_verified' ? 'bg-emerald-50/50' :
              'bg-gray-50'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    selectedNotification.type === 'handover_denied' ? 'bg-rose-100 text-rose-600' :
                    selectedNotification.type === 'claim_rejected' || selectedNotification.status === 'rejected' ? 'bg-red-100 text-red-600' :
                    selectedNotification.status === 'pending' ? 'bg-white text-amber-600' :
                    selectedNotification.status === 'approved' || selectedNotification.status === 'item_verified' ? 'bg-white text-emerald-600' :
                    'bg-white text-gray-600'
                  } shadow-sm`}>
                    {getIcon(selectedNotification.status, selectedNotification.type)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {selectedNotification.type === 'handover_denied' ? 'Handover Disputed / Recall' :
                       selectedNotification.type === 'item_recovered' ? 'Item Ready for Pickup' :
                       selectedNotification.type === 'dispute_resolved' ? 'Dispute Resolved' :
                       selectedNotification.status === 'item_verified' ? 'Item Verification' : 'Claim Details'}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">{new Date(selectedNotification.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedNotification(null)}
                  className="p-1 hover:bg-gray-200/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex gap-2">
                <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                  selectedNotification.type === 'handover_denied' ? 'bg-rose-100 text-rose-800' :
                  selectedNotification.type === 'item_recovered' ? 'bg-emerald-100 text-emerald-800' :
                  selectedNotification.type === 'dispute_resolved' ? 'bg-blue-100 text-blue-800' :
                  selectedNotification.type === 'claim_rejected' || selectedNotification.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  selectedNotification.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                  selectedNotification.status === 'approved' || selectedNotification.status === 'item_verified' ? 'bg-emerald-100 text-emerald-800' :
                  'bg-gray-200 text-gray-800'
                }`}>
                  {selectedNotification.type === 'handover_denied' ? 'Handover Denied / Recall' :
                   selectedNotification.type === 'item_recovered' ? 'Ready for Pickup' :
                   selectedNotification.type === 'dispute_resolved' ? 'Recall Pending' :
                   selectedNotification.type === 'claim_rejected' ? 'Rejected' :
                   selectedNotification.status === 'item_verified' ? 'Verified' : selectedNotification.status}
                </span>
                {selectedNotification.claim?.claimType === 'manual_review' && (
                  <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
                    Manual Review
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-blue-50 text-blue-600 rounded-md">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Found Item</p>
                    <p className="text-sm font-semibold text-gray-900 leading-tight">
                      {selectedNotification.claim?.itemId?.title || selectedNotification.itemTitle || 'Unknown Item'}
                    </p>
                  </div>
                </div>

                {selectedNotification.claim?.lostItemId && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-1 bg-amber-50 text-amber-600 rounded-md">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Linked Lost Item</p>
                      <p className="text-sm font-semibold text-gray-900 leading-tight">
                        {selectedNotification.claim.lostItemId.title || 'Unknown Item'}
                      </p>
                    </div>
                  </div>
                )}

                {selectedNotification.type === 'received' && selectedNotification.claim?.claimant && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-1 bg-purple-50 text-purple-600 rounded-md">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Claimant Name</p>
                      <p className="text-sm font-semibold text-gray-900 leading-tight">
                        {selectedNotification.claim.claimant.name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <Info className="w-3.5 h-3.5" />
                  Status Message
                </div>
                <p className="text-sm text-gray-700 leading-relaxed font-medium">
                  {selectedNotification.message || (
                    selectedNotification.type === 'handover_denied' ? "The department could not verify physical receipt of this item. Please review and update your submitted information with the correct details in My Reports." :
                    selectedNotification.status === 'item_verified' ? "The department has physically received and verified this reported item into faculty custody." :
                    selectedNotification.status === 'pending' ? "Admin will review and verify this claim. You do not need to take any action." :
                    selectedNotification.status === 'approved' ? "This claim was approved by admin." :
                    "This claim was rejected by admin."
                  )}
                </p>
                {(selectedNotification.type === 'claim_rejected' || selectedNotification.status === 'rejected') && selectedNotification.type !== 'handover_denied' && (
                  <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded mt-3 border border-gray-100 leading-relaxed">
                    <p>
                      Reason: {selectedNotification.reason || selectedNotification.claim?.reason || selectedNotification.claim?.reasonText || 'No reason provided by the department.'}
                    </p>
                    {(selectedNotification.reason === 'Item was successfully claimed by another user.' || selectedNotification.claim?.reason === 'Item was successfully claimed by another user.') && (
                      <p className="mt-1 font-semibold text-gray-800">
                        Please click 'View Item' below to file a Handover Dispute if you believe this is an error.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {selectedNotification.type === 'handover_denied' && selectedNotification.itemId && !selectedNotification.id.startsWith('db-') && (
                <Link
                  to={`/edit-item/${selectedNotification.itemId}`}
                  state={{ openEdit: true }}
                  onClick={() => {
                    setSelectedNotification(null);
                    setIsListOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl transition-all shadow-md active:scale-[0.98]"
                >
                  Update Handover Details
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedNotification(null)}
                  className={`${
                    selectedItemId ? 'flex-1' : 'w-full'
                  } py-3.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 transition-all shadow-sm active:scale-[0.98] text-sm`}
                >
                  Close Details
                </button>
                {selectedItemId && (
                  <Link
                    to={`/item/${selectedItemId}`}
                    onClick={() => {
                      setSelectedNotification(null);
                      setIsListOpen(false);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-md shadow-blue-200 active:scale-[0.98] text-sm"
                  >
                    View Item
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
