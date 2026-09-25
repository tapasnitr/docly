'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@docly/types';
import { apiFetch } from './api-client';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface RegisterInput {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  register: (input: RegisterInput) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  // Lets a page that mutates the user server-side (profile settings) update
  // the shared user without a full /auth/me round trip.
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  // Lets a server component (e.g. the (app) layout, which has already
  // resolved the session to decide whether to redirect) hand the user down
  // directly, skipping the extra client-side /auth/me round trip.
  initialUser?: User | null;
}

export function AuthProvider({ children, initialUser = null }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [status, setStatus] = useState<AuthStatus>(initialUser ? 'authenticated' : 'loading');

  useEffect(() => {
    if (initialUser) {
      return;
    }
    let cancelled = false;

    apiFetch<{ user: User }>('/v1/auth/me')
      .then((data) => {
        if (!cancelled) {
          setUser(data.user);
          setStatus('authenticated');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setStatus('unauthenticated');
        }
      });

    return () => {
      cancelled = true;
    };
    // Only ever runs the initial session check once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const data = await apiFetch<{ user: User }>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const data = await apiFetch<{ user: User }>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/v1/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, register, login, logout, setUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
