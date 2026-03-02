'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { dispatchMascotEvent } from '@/lib/utils/mascot-event';

interface AuthUser {
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  name: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    checkAuth();
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        const userData = data.data ?? data;
        setUser(userData.user ?? userData);
        scheduleRefresh();
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  function scheduleRefresh() {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const refreshMs = (3600 - 300) * 1000; // 55분 후 갱신
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        if (res.ok) {
          scheduleRefresh();
        } else {
          setUser(null);
          window.location.href = '/login';
        }
      } catch { setUser(null); }
    }, refreshMs);
  }

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? data.message ?? '로그인 실패');
    }
    const data = await res.json();
    const userData = data.data ?? data;
    setUser(userData.user ?? userData);
    scheduleRefresh();
    return userData.user ?? userData;
  }, []);

  const logout = useCallback(async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    setUser(null);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    window.location.href = '/login';
  }, []);

  return { user, isLoading, isAuthenticated: !!user, login, logout };
}
