import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface RequireVerificationProps {
  children: ReactNode;
}

export default function RequireVerification({ children }: RequireVerificationProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Admins, unauthenticated visitors (handled by ProtectedRoute), or verified users bypass overlay
  if (!user || user.isVerified || user.role === 'admin') {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      {/* Blurred background view of children */}
      <div className="filter blur-[4px] pointer-events-none select-none opacity-40">
        {children}
      </div>

      {/* Verification Overlay Card */}
      <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-white/60 backdrop-blur-[4px]">
        <div className="max-w-md w-full bg-white border border-amber-200 rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 text-amber-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Email Verification Required</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            You must verify your college email address before reporting items, submitting claims, or accessing protected student workflows.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm cursor-pointer"
            >
              Go to Profile to Verify
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
