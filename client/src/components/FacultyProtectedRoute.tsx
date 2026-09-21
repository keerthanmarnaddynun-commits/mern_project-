import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

export default function FacultyProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const token = localStorage.getItem('token');
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'faculty') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
