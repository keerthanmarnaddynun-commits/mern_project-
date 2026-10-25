import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

export interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Array<'user' | 'faculty' | 'admin'>;
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Handle loading state to avoid premature redirects during authentication initialization
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Determine if requester has an active session from HttpOnly cookie hydration
  if (!user) {
    const targetRedirect = location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
    return <Navigate to={targetRedirect} state={{ from: location }} replace />;
  }

  // Determine current effective role
  const currentRole = user.role || 'user';

  // If admin tries to access a route that doesn't permit admin, redirect to admin portal
  if (currentRole === 'admin' && allowedRoles && !allowedRoles.includes('admin')) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Enforce strict role authorization if allowedRoles are specified
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(currentRole)) {
      if (currentRole === 'admin') {
        return <Navigate to="/admin/dashboard" replace />;
      }
      if (currentRole === 'faculty') {
        return <Navigate to="/faculty-dashboard" replace />;
      }
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
