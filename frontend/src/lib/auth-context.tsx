'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

export interface User {
  id: number;
  employeeId: string;
  name: string;
  email: string;
  role: 'EMPLOYEE' | 'HR' | 'DIRECTOR';
  department?: string;
  designation?: string;
  annualQuota?: number;
  usedQuota?: number;
  remainingQuota?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, pass: string) => Promise<void>;
  quickLogin: (role: 'EMPLOYEE' | 'HR' | 'DIRECTOR') => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isDirector: boolean;
  isHR: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('durozen_token');
    const savedUser = localStorage.getItem('durozen_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
        // Verify with server in background
        api.auth
          .me()
          .then((profile) => {
            setUser(profile);
            localStorage.setItem('durozen_user', JSON.stringify(profile));
          })
          .catch(() => {
            // Token might be expired
            logout();
          })
          .finally(() => setLoading(false));
      } catch {
        logout();
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (identifier: string, pass: string) => {
    const res = await api.auth.login(identifier, pass);
    setToken(res.accessToken);
    setUser(res.user);
    localStorage.setItem('durozen_token', res.accessToken);
    localStorage.setItem('durozen_user', JSON.stringify(res.user));
  };

  const quickLogin = async (role: 'EMPLOYEE' | 'HR' | 'DIRECTOR') => {
    const res = await api.auth.quickLogin(role);
    setToken(res.accessToken);
    setUser(res.user);
    localStorage.setItem('durozen_token', res.accessToken);
    localStorage.setItem('durozen_user', JSON.stringify(res.user));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('durozen_token');
    localStorage.removeItem('durozen_user');
  };

  const refreshProfile = async () => {
    if (!token) return;
    try {
      const profile = await api.auth.me();
      setUser(profile);
      localStorage.setItem('durozen_user', JSON.stringify(profile));
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };

  const isAdmin = user?.role === 'HR' || user?.role === 'DIRECTOR';
  const isDirector = user?.role === 'DIRECTOR';
  const isHR = user?.role === 'HR';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        quickLogin,
        logout,
        refreshProfile,
        isAdmin,
        isDirector,
        isHR,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
