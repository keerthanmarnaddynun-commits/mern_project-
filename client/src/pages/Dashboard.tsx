import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, PlusCircle, Filter, SlidersHorizontal, AlertCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import ItemCard from '../components/ItemCard';
import { fetchItems } from '../services/api';
import type { Item, ItemType } from '../types';
import { CATEGORIES } from '../types';

type FilterType = 'all' | ItemType;

export default function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchItems(typeFilter === 'all' ? undefined : typeFilter);
        setItems(data);
      } catch {
        setError('Failed to load items');
        setItems([]);
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            {(['all', 'lost', 'found'] as FilterType[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  typeFilter === t
                    ? t === 'lost'
                      ? 'bg-red-100 text-red-700'
                      : t === 'found'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {t === 'all' ? 'All items' : t.charAt(0).toUpperCase() + t.slice(1)}
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
    </div>
  );
}
