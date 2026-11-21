/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useUser, useAuth as useClerkAuth } from '@clerk/react';
import { setUser, type User } from '../store/userAuthSlice';
import { resetChats } from '../store/chatSlice';
import { clerkFetch, setGetTokenFn } from '../lib/clerkFetch';
import type { RootState } from '../store/store';

type AuthStatus = 'loading' | 'ready' | 'error' | 'signed-out';

interface AuthContextValue {
  status: AuthStatus;
  loading: boolean;
  hasSession: boolean;
  error: string | null;
  retry: () => void;
}

interface AccountError {
  clerkId: string;
  message: string;
}

const AuthContext = createContext<AuthContextValue>({
  status: 'loading',
  loading: true,
  hasSession: false,
  error: null,
  retry: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const reduxUser = useSelector((s: RootState) => s.userAuth.user);
  const { isLoaded, user: clerkUser } = useUser();
  const { getToken } = useClerkAuth();
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<AccountError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const clerkId = clerkUser ? clerkUser.id : null;

  function retry() {
    setAccountError(null);
    setAttempt(attempt + 1);
  }

  useEffect(() => {
    setGetTokenFn(getToken);
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || clerkId === null) {
      return;
    }

    let cancelled = false;

    const fetchDbUser = async () => {
      try {
        const res = await clerkFetch('/api/auth/setup-user', { method: 'POST' });

        if (res.ok === false) {
          if (cancelled === false) {
            setResolvedId(null);
            setAccountError({ clerkId, message: `Could not load your account (status ${res.status}).` });
          }
          return;
        }

        const data: { user: User } = await res.json();
        if (data.user === null || data.user === undefined) {
          if (cancelled === false) {
            setResolvedId(null);
            setAccountError({ clerkId, message: 'Your account record was not found.' });
          }
          return;
        }

        const dbUser: User = {
          id: data.user.id,
          user_name: data.user.user_name,
          email: data.user.email,
          created_at: data.user.created_at,
          image_url: data.user.image_url,
          is_verified: data.user.is_verified,
          last_login: data.user.last_login,
          user_tag: data.user.user_tag,
          bio: data.user.bio,
        };

        if (cancelled === false) {
          dispatch(setUser(dbUser));
          setResolvedId(clerkId);
          setAccountError(null);
        }
      } catch (err) {
        console.error(err);
        if (cancelled === false) {
          setResolvedId(null);
          setAccountError({
            clerkId,
            message: 'The account request failed. Check your connection and try again.',
          });
        }
      }
    };

    fetchDbUser();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, clerkId, dispatch, attempt]);

  useEffect(() => {
    if (!isLoaded || clerkId !== null) {
      return;
    }

    dispatch(setUser(null));
    dispatch(resetChats());
  }, [isLoaded, clerkId, dispatch]);

  const hasSession = isLoaded && clerkId !== null;
  const error =
    accountError !== null && accountError.clerkId === clerkId ? accountError.message : null;

  let status: AuthStatus;
  if (!isLoaded) {
    status = 'loading';
  } else if (clerkId === null) {
    status = 'signed-out';
  } else if (error !== null) {
    status = 'error';
  } else if (resolvedId === clerkId && reduxUser !== null) {
    status = 'ready';
  } else {
    status = 'loading';
  }

  const loading = status === 'loading';

  return (
    <AuthContext.Provider value={{ status, loading, hasSession, error, retry }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
