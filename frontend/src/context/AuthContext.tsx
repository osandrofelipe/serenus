'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { authAPI } from '@/lib/api';

interface User {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: 'client' | 'professional' | 'admin';
  avatar_url?: string;
  email_verified: boolean;
  pro_id?: string;
  approval_status?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = Cookies.get('accessToken');
      if (!token) { setUser(null); return; }
      const res = await authAPI.me();
      setUser(res.data);
    } catch {
      setUser(null);
      Cookies.remove('accessToken');
      Cookies.remove('refreshToken');
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await authAPI.login(email, password);
    const { user: userData, accessToken, refreshToken } = res.data;
    Cookies.set('accessToken', accessToken, { expires: 7, secure: true, sameSite: 'strict' });
    Cookies.set('refreshToken', refreshToken, { expires: 30, secure: true, sameSite: 'strict' });
    setUser(userData);
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch (_) {}
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useRequireAuth(role?: string) {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/login';
    }
    if (!loading && user && role && user.role !== role) {
      window.location.href = '/dashboard';
    }
  }, [user, loading, role]);
  return { user, loading };
}
