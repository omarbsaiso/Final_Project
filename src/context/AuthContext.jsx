import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => authService.subscribeToAuth((nextUser, error) => {
    if (error) {
      const code = typeof error.code === 'string' ? error.code : error.name || 'UnknownError';
      console.error('[Auth] Session restore failed', { code });
    }
    setUser(nextUser);
    setLoading(false);
  }), []);

  const login = useCallback(async (email, password, language) => {
    const nextUser = await authService.signIn(email, password, language);
    setUser(nextUser);
    return nextUser;
  }, []);

  const signup = useCallback(async (fullName, email, password, language) => {
    const nextUser = await authService.signUp(fullName, email, password, language);
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    await authService.logOut();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, signup, logout, setUser }), [user, loading, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
