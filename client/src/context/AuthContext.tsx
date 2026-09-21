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
  signOut: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isUserShape(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o._id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.email === 'string'
  );
}

function parseStoredUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isUserShape(parsed)) return parsed;
  } catch {
    /* invalid JSON */
  }
  return null;
}

function normalizeUser(nextUser: unknown): User | null {
  if (!nextUser || typeof nextUser !== 'object') return null;
  const o = nextUser as Record<string, unknown>;
  const _id = o._id != null ? String(o._id) : '';
  const name = o.name != null ? String(o.name) : '';
  const email = o.email != null ? String(o.email) : '';
  const role = o.role === 'faculty' ? 'faculty' : (o.role === 'user' ? 'user' : undefined);
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = parseStoredUser(localStorage.getItem('user'));
    if (token && storedUser) {
      setUser(storedUser);
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    setLoading(false);
  }, []);

  const persistSession = (token: string, nextUser: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const login = async (email: string, password: string) => {
    try {
      const { data } = await API.post<{ token: string; user?: unknown; admin?: unknown; isAdmin?: boolean }>('/auth/login', {
        email,
        password,
      });

      if (data.isAdmin) {
        return { success: true, isAdmin: true, token: data.token };
      }

      const { token, user: rawUser } = data;
      const nextUser = normalizeUser(rawUser);
      if (!token || !nextUser) {
        throw new Error('Invalid response from server');
      }
      persistSession(token, nextUser);
      return { success: true, isAdmin: false };
    } catch (error) {
      throw toAuthError(error, 'Login failed');
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data } = await API.post<{ token: string; user: unknown }>('/auth/register', {
        name: fullName,
        email,
        password,
      });
      const { token, user: rawUser } = data;
      const nextUser = normalizeUser(rawUser);
      if (!token || !nextUser) {
        throw new Error('Invalid response from server');
      }
      persistSession(token, nextUser);
    } catch (error) {
      throw toAuthError(error, 'Registration failed');
    }
  };

  const signOut = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (updatedUser: User) => {
    const token = localStorage.getItem('token');
    if (token) {
      persistSession(token, updatedUser);
    }
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
