import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import API from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; isAdmin?: boolean; token?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: (navigateFn?: (path: string, options?: { replace?: boolean }) => void) => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);



function normalizeUser(nextUser: unknown): User | null {
  if (!nextUser || typeof nextUser !== 'object') return null;
  const o = nextUser as Record<string, unknown>;
  const _id = o._id != null ? String(o._id) : '';
  const name = o.name != null ? String(o.name) : '';
  const email = o.email != null ? String(o.email) : '';
  const role = o.role === 'admin' ? 'admin' : (o.role === 'faculty' ? 'faculty' : (o.role === 'user' ? 'user' : undefined));
  const department = typeof o.department === 'string' ? o.department : undefined;
  if (!_id || !email) return null;
  return { _id, name, email, role, department };
}

function toAuthError(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    const msg = (error.response?.data as { message?: string } | undefined)?.message;
    if (typeof msg === 'string' && msg.trim()) return new Error(msg);
  }
  if (error instanceof Error) return error;
  return new Error(fallback);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate user session on mount via HttpOnly cookie using /me endpoint
  useEffect(() => {
    let isMounted = true;

    const fetchCurrentUser = async () => {
      try {
        const { data } = await API.get<{ user?: unknown }>('/auth/me');
        const nextUser = normalizeUser(data.user || data);
        if (isMounted) {
          setUser(nextUser);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { data } = await API.post<{ token?: string; user?: unknown; admin?: unknown; isAdmin?: boolean }>('/auth/login', {
        email,
        password,
      });

      if (data.isAdmin) {
        // Fetch session profile via /me
        try {
          const meRes = await API.get<{ user?: unknown }>('/auth/me');
          const meUser = normalizeUser(meRes.data.user || meRes.data);
          if (meUser) {
            setUser(meUser);
            return { success: true, isAdmin: true, token: data.token };
          }
        } catch {
          // fallback admin state
        }
        const adminUser: User = {
          _id: '000000000000000000000000',
          name: 'System Admin',
          email,
          role: 'admin',
        };
        setUser(adminUser);
        return { success: true, isAdmin: true, token: data.token };
      }

      // Immediately call /me to fetch verified authenticated user profile
      const meRes = await API.get<{ user?: unknown }>('/auth/me');
      const nextUser = normalizeUser(meRes.data.user || meRes.data) || normalizeUser(data.user);
      if (!nextUser) {
        throw new Error('Failed to retrieve user profile after login');
      }
      setUser(nextUser);
      return { success: true, isAdmin: false };
    } catch (error) {
      throw toAuthError(error, 'Login failed');
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data } = await API.post<{ token?: string; user?: unknown }>('/auth/register', {
        name: fullName,
        email,
        password,
      });
      // Hydrate via /me
      try {
        const meRes = await API.get<{ user?: unknown }>('/auth/me');
        const nextUser = normalizeUser(meRes.data.user || meRes.data) || normalizeUser(data.user);
        if (nextUser) {
          setUser(nextUser);
          return;
        }
      } catch {
        // fallback
      }
      const nextUser = normalizeUser(data.user);
      if (nextUser) {
        setUser(nextUser);
      }
    } catch (error) {
      throw toAuthError(error, 'Registration failed');
    }
  };

  const signOut = async (navigateFn?: (path: string, options?: { replace?: boolean }) => void) => {
    try {
      await API.post('/auth/logout');
    } catch {
      // Ignore network errors during signout
    } finally {
      setUser(null);
      if (navigateFn) {
        const isAdminRoute = window.location.pathname.startsWith('/admin');
        navigateFn(isAdminRoute ? '/admin/login' : '/login', { replace: true });
      }
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signUp, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
