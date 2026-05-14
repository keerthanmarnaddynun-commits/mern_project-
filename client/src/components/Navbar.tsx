import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, MapPin, PlusCircle, LogOut, Menu, X, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-blue-700 transition-colors">
              <Search className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">
              Found<span className="text-blue-600">It</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/dashboard"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/dashboard')
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Browse Items
            </Link>
            <Link
              to="/post"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                isActive('/post')
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              Report Item
            </Link>
          </div>

          {user ? (
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg min-w-0 max-w-[220px]">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="min-w-0 flex flex-col leading-tight">
                  <span className="text-sm text-gray-900 font-medium truncate" title={user.name}>
                    {user.name}
                  </span>
                  <span className="text-xs text-gray-500 truncate" title={user.email}>
                    {user.email}
                  </span>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link to="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                Sign in
              </Link>
              <Link to="/register" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                Sign up
              </Link>
            </div>
          )}

          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          <Link
            to="/dashboard"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <MapPin className="w-4 h-4" />
            Browse Items
          </Link>
          <Link
            to="/post"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <PlusCircle className="w-4 h-4" />
            Report Item
          </Link>
          {user ? (
            <>
              <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 mb-1">
                <p className="font-medium text-gray-800 truncate">{user.name}</p>
                <p className="truncate">{user.email}</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); handleSignOut(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)} className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Sign in</Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50">Sign up</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
