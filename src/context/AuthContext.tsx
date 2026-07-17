import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import { setUser } from '../store/userAuthSlice';

interface AuthContextValue {
  login: (email: string, password: string) => Promise<void>;
  signup: (user_name: string, email: string, password: string) => Promise<{ email?: string } | undefined>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/TokenVerificationRouter/session`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        dispatch(setUser(data.user));
      } else {
        dispatch(setUser(null));
      }
    } catch {
      dispatch(setUser(null));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(()=>{

     refreshSession();
     
  },[refreshSession])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/EmailVerificaitonRouter/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error);
    }

    const data = await res.json();
    dispatch(setUser(data.user));
  }, [dispatch]);

  const signup = useCallback(async (user_name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/EmailVerificaitonRouter/signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name, email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Signup failed' }));
      throw new Error(err.error);
    }

    const data = await res.json();
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/EmailVerificaitonRouter/logout', {
      method: 'POST',
      credentials: 'include',
    });
    dispatch(setUser(null));
  }, [dispatch]);

  return (
    <AuthContext.Provider value={{ login, signup, logout, refreshSession, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(){
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
