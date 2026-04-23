import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  User,
  Clock,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { fetchItemById, markResolved, deleteItem } from '../services/api';
import type { Item } from '../types';
import { useAuth } from '../context/AuthContext';

export default function ItemDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const data = await fetchItemById(id);
        setItem(data);
      } catch (err) {
        setError('Failed to load item details');
        setItem(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleResolve = async () => {
    if (!item) return;
    setActionLoading(true);
    try {
      await markResolved(item._id);
      setResolved(true);
      setItem((p) => p ? { ...p, status: 'resolved', is_resolved: true } : p);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to mark as resolved');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!item || !confirm('Are you sure you want to delete this item?')) return;
    setActionLoading(true);
    try {
      await deleteItem(item._id);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
      setActionLoading(false);
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

  const isOwner = user?._id === item.postedBy;
  const isLost = item.type === 'lost';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to all items
        </Link>

        {error && (
          <div className="mb-4 flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {(item.status === 'resolved' || item.is_resolved || resolved) && (
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

            <div className="border-t border-gray-100 pt-6">
              <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                Contact the reporter
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={`mailto:${item.contact_email}`}
                  className="flex items-center gap-2.5 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors flex-1 justify-center"
                >
                  <Mail className="w-4 h-4" />
                  {item.contact_email}
                </a>
                {item.contact_phone && (
                  <a
                    href={`tel:${item.contact_phone}`}
                    className="flex items-center gap-2.5 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-xl transition-colors flex-1 justify-center"
                  >
                    <Phone className="w-4 h-4" />
                    {item.contact_phone}
                  </a>
                )}
              </div>
            </div>

            {isOwner && item.status === 'pending' && !item.is_resolved && !resolved && (
              <div className="border-t border-gray-100 pt-6 mt-6">
                <p className="text-xs text-gray-400 mb-3">Owner actions</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleResolve}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark as Resolved
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
