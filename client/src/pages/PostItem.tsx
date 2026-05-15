import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  AlertCircle,
  CheckCircle,
  MapPin,
  Calendar,
  Tag,
  FileText,
  Phone,
  Mail,
  Image,
  ChevronDown,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { createItem, fetchItems } from '../services/api';
import { CATEGORIES, type Item } from '../types';
import { useAuth } from '../context/AuthContext';

export default function PostItem() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: location.state?.prefillCategory || 'Other',
    type: (location.state?.prefillType as 'lost' | 'found') || 'lost',
    location: '',
    date_occurred: new Date().toISOString().split('T')[0],
    image_url: '',
    contact_email: user?.email ?? '',
    contact_phone: '',
  });

  useEffect(() => {
    if (location.state?.prefillCategory || location.state?.prefillType) {
      setForm(prev => ({
        ...prev,
        category: location.state.prefillCategory || prev.category,
        type: location.state.prefillType || prev.type,
      }));
    }
  }, [location.state]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Item[]>([]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const token = localStorage.getItem('token');
    if (!user || !token) {
      navigate('/login', {
        replace: true,
        state: { sessionMessage: 'You must be signed in to post an item.' },
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        type: form.type,
        location: form.location,
        date_occurred: form.date_occurred,
        image_url: form.image_url || null,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone || null,
      };

      await createItem(payload);

      const allItems = await fetchItems();

      const getWords = (text: string) => text.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      const currentWords = [...getWords(form.title), ...getWords(form.description)];
      const currentLocWords = getWords(form.location);

      const possibleMatches = allItems.filter(item => {
        if (item.type === form.type) return false;
        if (item.category !== form.category) return false;

        const itemText = (item.title + " " + item.description).toLowerCase();
        const hasWordMatch = currentWords.some(w => itemText.includes(w));

        const itemLoc = item.location.toLowerCase();
        const hasLocMatch = currentLocWords.some(w => itemLoc.includes(w)) || 
                            itemLoc.includes(form.location.toLowerCase()) || 
                            form.location.toLowerCase().includes(itemLoc);

        return hasWordMatch && hasLocMatch;
      });

      setMatches(possibleMatches);
      setSuccess(true);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        const msg =
          typeof (err.response?.data as { message?: string } | undefined)?.message === 'string'
            ? (err.response?.data as { message: string }).message
            : 'Your session is invalid or has expired. Please sign in again.';
        await signOut();
        navigate('/login', { replace: true, state: { sessionMessage: msg } });
        return;
      }
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
          : undefined;
      setError(data?.message ?? (err instanceof Error ? err.message : 'Failed to submit item'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Item Reported Successfully!</h2>
            <p className="text-gray-500 mb-6">
              Your item has been posted to the board.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              Go to Dashboard
            </button>
          </div>

          {matches.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-8 border border-blue-100">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-blue-600" />
                Possible Matches Found ({matches.length})
              </h3>
              <p className="text-gray-500 mb-6 text-sm">
                We found some {form.type === 'lost' ? 'found' : 'lost'} items that might match yours based on category, description, and location.
              </p>
              <div className="grid gap-4">
                {matches.map(match => (
                  <div 
                    key={match._id} 
                    className="border border-gray-100 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer bg-gray-50 hover:bg-white" 
                    onClick={() => navigate(`/item/${match._id}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-gray-900">{match.title}</h4>
                      <span className="text-xs font-medium px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-full shadow-sm">
                        {new Date(match.date_occurred).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 gap-4">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" /> {match.location}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Report an Item</h1>
          <p className="text-gray-500 text-sm">Fill in the details below to post a lost or found item</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {error && (
            <div className="mb-6 flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, type: 'lost' }))}
                  className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                    form.type === 'lost'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  I Lost Something
                </button>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, type: 'found' }))}
                  className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                    form.type === 'found'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  I Found Something
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Item title <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Black iPhone 14, Brown leather wallet..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                required
                rows={4}
                placeholder="Describe the item in detail — color, brand, distinguishing marks..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="w-full pl-10 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    name="date_occurred"
                    value={form.date_occurred}
                    onChange={handleChange}
                    required
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Location <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Central Park, Subway Line 2, Coffee shop on Main St."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Image URL <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Image className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  name="image_url"
                  value={form.image_url}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <p className="text-sm font-medium text-gray-700 mb-4">Contact information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      name="contact_email"
                      value={form.contact_email}
                      onChange={handleChange}
                      required
                      placeholder="your@email.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">
                    Phone <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      name="contact_phone"
                      value={form.contact_phone}
                      onChange={handleChange}
                      placeholder="+1 555-0000"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Posting...
                  </>
                ) : (
                  'Post Item'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
