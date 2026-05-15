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
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getReceivedClaims, getMyClaims } from '../services/api';

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
}

interface Notification {
  id: string;
  type: 'received' | 'submitted';
  status: string;
  message: string;
  timestamp: string;
  claim: Claim;
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
          const [received, submitted] = await Promise.all([
            getReceivedClaims(),
            getMyClaims()
          ]);
          setReceivedClaims(received);
          setMyClaims(submitted);
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
    ...receivedClaims.map(c => ({
      id: `received-${c._id}`,
      type: 'received' as const,
      status: c.status,
      message: c.status === 'pending' 
        ? `Someone submitted a claim for your item "${c.itemId?.title || 'Unknown Item'}"`
        : `A claim for your item "${c.itemId?.title || 'Unknown Item'}" was ${c.status}`,
      timestamp: c.updatedAt || c.createdAt,
      claim: c
    })),
    ...myClaims.map(c => ({
      id: `submitted-${c._id}`,
      type: 'submitted' as const,
      status: c.status,
      message: `Your claim for "${c.itemId?.title || 'Unknown Item'}" was ${c.status}`,
      timestamp: c.updatedAt || c.createdAt,
      claim: c
    }))
  ]
  .filter(n => !(n.type === 'submitted' && n.status === 'pending'))
  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  .slice(0, 10);

  // Stable ID for tracking seen state
  const getStableId = (n: Notification) => `${n.claim._id}-${n.status}-${n.timestamp}`;
  
  const unseenCount = notifications.filter(n => !seenIds.includes(getStableId(n))).length;

  const handleOpenPanel = () => {
    setIsListOpen(true);
    const currentBatchIds = notifications.map(getStableId);
    const updatedSeenIds = Array.from(new Set([...seenIds, ...currentBatchIds]));
    setSeenIds(updatedSeenIds);
    localStorage.setItem('seen_notifications', JSON.stringify(updatedSeenIds));
  };

  const getIcon = (status: string) => {
    if (status === 'pending') return <Clock className="w-4 h-4 text-amber-500" />;
    if (status === 'approved') return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    if (status === 'rejected') return <XCircle className="w-4 h-4 text-red-500" />;
    return <Info className="w-4 h-4 text-blue-500" />;
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
                      <div className="mt-1 flex-shrink-0">
                        {getIcon(n.status)}
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
                            n.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            n.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {n.status}
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
              selectedNotification.status === 'pending' ? 'bg-amber-50/50' :
              selectedNotification.status === 'approved' ? 'bg-emerald-50/50' :
              'bg-gray-50'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    selectedNotification.status === 'pending' ? 'bg-white text-amber-600' :
                    selectedNotification.status === 'approved' ? 'bg-white text-emerald-600' :
                    'bg-white text-gray-600'
                  } shadow-sm`}>
                    {getIcon(selectedNotification.status)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Claim Details</h3>
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
                  selectedNotification.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                  selectedNotification.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                  'bg-gray-200 text-gray-800'
                }`}>
                  {selectedNotification.status}
                </span>
                {selectedNotification.claim.claimType === 'manual_review' && (
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
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{selectedNotification.claim.itemId?.title || 'Unknown Item'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-amber-50 text-amber-600 rounded-md">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Linked Lost Item</p>
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{selectedNotification.claim.lostItemId?.title || 'Unknown Item'}</p>
                  </div>
                </div>

                {selectedNotification.type === 'received' && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-1 bg-purple-50 text-purple-600 rounded-md">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Claimant Name</p>
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{selectedNotification.claim.claimant?.name || 'Unknown'}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <Info className="w-3.5 h-3.5" />
                  Status Message
                </div>
                <p className="text-sm text-gray-600 leading-relaxed font-medium">
                  {selectedNotification.status === 'pending' && "Admin will review and verify this claim. You do not need to take any action."}
                  {selectedNotification.status === 'approved' && "This claim was approved by admin."}
                  {selectedNotification.status === 'rejected' && "This claim was rejected by admin."}
                </p>
              </div>

              <button
                onClick={() => setSelectedNotification(null)}
                className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 active:scale-[0.98]"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
