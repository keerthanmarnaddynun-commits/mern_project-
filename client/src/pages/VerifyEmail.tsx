import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowRight, Mail, Home } from 'lucide-react';
import { verifyEmail } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (!token || !token.trim()) {
      setLoading(false);
      setError('Missing verification token. Please check your verification link or request a new one.');
      return;
    }

    if (hasAttempted.current) {
      return;
    }
    hasAttempted.current = true;

    const performVerification = async () => {
      try {
        const response = await verifyEmail(token.trim());
        setSuccess(true);
        setMessage(response.message || 'Your email address has been verified successfully!');

        // Broadcast to other open tabs to immediately refresh their auth state
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const authChannel = new BroadcastChannel('auth_sync');
          authChannel.postMessage('EMAIL_VERIFIED');
          authChannel.close();
        }

        // If the user is currently logged in, update their local context state
        if (user) {
          updateUser({
            ...user,
            isVerified: true,
            ...(response.email ? { email: response.email, pendingEmail: null } : {}),
          });
        }
      } catch (err: any) {
        setSuccess(false);
        const apiMessage = err?.response?.data?.message || err?.message || 'Email verification failed. The link may have expired or already been used.';
        setError(apiMessage);
      } finally {
        setLoading(false);
      }
    };

    performVerification();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        {loading && (
          <div className="py-8 space-y-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
            <h1 className="text-xl font-bold text-gray-900">Verifying your email</h1>
            <p className="text-sm text-gray-500">
              Please wait while we confirm your college email address...
            </p>
          </div>
        )}

        {!loading && success && (
          <div className="py-6 space-y-4">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Email Verified</h1>
            <p className="text-sm text-gray-600 max-w-sm mx-auto">
              Your original session has been updated. You can safely close this window and return to your previous tab.
            </p>
            <div className="pt-4">
              <button
                onClick={() => {
                  window.close();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        )}

        {!loading && !success && (
          <div className="py-6 space-y-4">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto border border-red-100">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Verification Failed</h1>
            <p className="text-sm text-red-600 max-w-sm mx-auto bg-red-50 border border-red-100 p-3 rounded-xl">
              {error}
            </p>
            <div className="pt-4 space-y-2">
              {user ? (
                <Link
                  to="/profile"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm"
                >
                  <Mail className="w-4 h-4" />
                  Request New Verification Link
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm"
                >
                  Back to Sign In
                </Link>
              )}
              <div>
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 pt-2"
                >
                  <Home className="w-3.5 h-3.5" />
                  Campus Lost & Found Home
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
