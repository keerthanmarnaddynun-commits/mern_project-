import type { ReactNode } from 'react';
import ProtectedRoute from './ProtectedRoute';

export default function FacultyProtectedRoute({ children }: { children: ReactNode }) {
  return <ProtectedRoute allowedRoles={['faculty', 'admin']}>{children}</ProtectedRoute>;
}
