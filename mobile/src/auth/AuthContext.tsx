import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokenStore, setSessionExpiredHandler, ApiError } from '../api/client';
import * as authApi from '../api/auth';
import { registerForPushNotifications } from '../api/push';
import { EmployeeAuthProfile } from '../types';

const EMPLOYEE_CACHE_KEY = 'ssc_field_employee_profile';

interface AuthState {
  employee: EmployeeAuthProfile | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<EmployeeAuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const doLogout = useCallback(async () => {
    await tokenStore.clear();
    await AsyncStorage.removeItem(EMPLOYEE_CACHE_KEY);
    setEmployee(null);
  }, []);

  // Session expiry (refresh token also invalid) forces a clean logout,
  // wherever in the app it happens — including mid-tracking-session.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      doLogout();
    });
  }, [doLogout]);

  useEffect(() => {
    (async () => {
      try {
        const token = await tokenStore.getAccessToken();
        const cached = await AsyncStorage.getItem(EMPLOYEE_CACHE_KEY);
        if (token && cached) {
          setEmployee(JSON.parse(cached));
          registerForPushNotifications().catch(() => {});
          // Revalidate in the background; if the token is dead the response
          // interceptor's refresh flow (or session-expired handler) takes over.
          try {
            const { employee: fresh } = await authApi.me();
            setEmployee(fresh);
            await AsyncStorage.setItem(EMPLOYEE_CACHE_KEY, JSON.stringify(fresh));
          } catch {
            // stay on cached profile; interceptor will log out if truly expired
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      const res = await authApi.login(username, password);
      await tokenStore.setTokens(res.access_token, res.refresh_token);
      await AsyncStorage.setItem(EMPLOYEE_CACHE_KEY, JSON.stringify(res.employee));
      setEmployee(res.employee);
      // Best-effort — a failed push registration never blocks login.
      registerForPushNotifications().catch(() => {});
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // best-effort; tokens are discarded client-side regardless
    }
    await doLogout();
  }, [doLogout]);

  return (
    <AuthContext.Provider value={{ employee, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
