import type { ReactNode } from 'react';
import ProtectedRoute from '../ProtectedRoute';

export default function AdminProtectedRoute({ children }: { children: ReactNode }) {
  return <ProtectedRoute allowedRoles={['admin']}>{children}</ProtectedRoute>;
}
