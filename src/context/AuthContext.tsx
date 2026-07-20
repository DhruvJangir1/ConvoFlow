import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import { setUser, type User } from '../store/userAuthSlice';

const REFRESH_BUFFER_MS = 60 * 1000;
const SESSION_KEY = 'convoflow_session';

let backgroundTimerId: ReturnType<typeof setTimeout> | null = null;

// ==========================================
// 1. ISOLATED BROWSER / API UTILITIES
// ==========================================

async function getSessionFromApi(): Promise<{ user: User; accessTokenExpiresAt: number }> {
  const res = await fetch(`/api/auth/TokenVerificationRouter/session`, { credentials: 'include' });
  if (!res.ok) throw new Error('Session verification failed');
  return res.json();
}

function scheduleBrowserTimeout(expiresAt: number, onTimeoutTriggered: () => void): void {
  if (backgroundTimerId) clearTimeout(backgroundTimerId);

  const delay = expiresAt - Date.now() - REFRESH_BUFFER_MS;
  if (delay <= 0) {
    onTimeoutTriggered();
    return;
  }

  backgroundTimerId = setTimeout(onTimeoutTriggered, delay);
}

function cancelBrowserTimeout(): void {
  if (backgroundTimerId) {
    clearTimeout(backgroundTimerId);
    backgroundTimerId = null;
  }
}

// ==========================================
// AUTH PROVIDER COMPONENT
// ==========================================

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
  
  // loading is ONLY for the initial boot mount check
  const [loading, setLoading] = useState(true);
  const [loopTriggerIndex, setLoopTriggerIndex] = useState(0);

  // ==========================================
  // 2. ISOLATED COORDINATION FUNCTIONS
  // ==========================================

  // Centralized state and storage syncing
  const updateLocalAuthState = useCallback((user: User | null, expiresAt?: number) => {
    dispatch(setUser(user));
    if (user && expiresAt) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user, accessTokenExpiresAt: expiresAt }));
    } else {
      localStorage.removeItem(SESSION_KEY);
      cancelBrowserTimeout();
    }
  }, [dispatch]);

  // Hits the backend server to renew the session details silenty
  const fetchAndSaveRenewedSession = useCallback(async (): Promise<number | null> => {
    try {
      const data = await getSessionFromApi();
      updateLocalAuthState(data.user, data.accessTokenExpiresAt);
      return data.accessTokenExpiresAt;
    } catch {
      updateLocalAuthState(null);
      return null;
    }
  }, [updateLocalAuthState]);

  // ==========================================
  // 3. EFFECT LIFE-CYCLE LOOP
  // ==========================================
  
  useEffect(() => {
    const rawData = localStorage.getItem(SESSION_KEY);
    const stored = rawData ? JSON.parse(rawData) : null;
    const timeNow = Date.now();

    const queueNextLoopCycle = (expiry: number) => {
      scheduleBrowserTimeout(expiry, () => {
        setLoopTriggerIndex(prev => prev + 1);
      });
    };

    // Optimistically hydrate UI out of localStorage immediately so the screen doesn't blank out
    if (stored && (stored.accessTokenExpiresAt - timeNow > REFRESH_BUFFER_MS)) {
      dispatch(setUser(stored.user));
    }

    // Always hit the server on mount or loop tick to validate/refresh the session token
    fetchAndSaveRenewedSession().then((expiry) => {
      if (expiry) queueNextLoopCycle(expiry);
      setLoading(false); // Drop initial boot loading gate once server responds
    });

    return () => cancelBrowserTimeout();
  }, [loopTriggerIndex, dispatch, fetchAndSaveRenewedSession]);

  // ==========================================
  // AUTH ACTIONS
  // ==========================================

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/EmailVerificaitonRouter/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Login failed');
    }

    const data = await res.json();
    updateLocalAuthState(data.user, data.accessTokenExpiresAt);
    
    scheduleBrowserTimeout(data.accessTokenExpiresAt, () => {
      setLoopTriggerIndex(prev => prev + 1);
    });
  }, [updateLocalAuthState]);

  const signup = useCallback(async (user_name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/EmailVerificaitonRouter/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name, email, password }),
      credentials: 'include',
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Signup failed');
    }
    
    const data = await res.json();
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    updateLocalAuthState(null);
    await fetch('/api/auth/EmailVerificaitonRouter/logout', { method: 'POST', credentials: 'include' });
  }, [updateLocalAuthState]);

  const triggerManualRefresh = useCallback(async () => {
    const expiry = await fetchAndSaveRenewedSession();
    if (expiry) {
      scheduleBrowserTimeout(expiry, () => {
        setLoopTriggerIndex(prev => prev + 1);
      });
    }
  }, [fetchAndSaveRenewedSession]);

  return (
    <AuthContext.Provider value={{ login, signup, logout, refreshSession: triggerManualRefresh, loading }}>
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}