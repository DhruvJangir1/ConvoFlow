import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import { useUser, useAuth as useClerkAuth } from '@clerk/react';
import { setUser, type User } from '../store/userAuthSlice';
import { clerkFetch, setGetTokenFn } from '../lib/clerkFetch';

interface AuthContextValue {
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const { isLoaded, user: clerkUser } = useUser();
  const { getToken } = useClerkAuth();
  const [dbUserFetched, setDbUserFetched] = useState(false);

  setGetTokenFn(getToken);

  useEffect(() => {
    console.log('[AuthProvider] useEffect fired — isLoaded:', isLoaded, 'clerkUser:', !!clerkUser);
    if (!isLoaded) return;

    if (clerkUser) {
      console.log('[AuthProvider] Clerk user present — id:', clerkUser.id);
      const fetchDbUser = async () => {
        try {
          console.log('[AuthProvider] Calling POST /api/auth/setup-user...');

          const res = await clerkFetch('/api/auth/setup-user', { method: 'POST' });

          console.log('[AuthProvider] Response status:', res.status);

          if (!res.ok) {
            const body = await res.text();
            console.error('[AuthProvider] ✗ setup-user returned', res.status, body);
            dispatch(setUser(null));
            setDbUserFetched(true);
            return;
          }

          const data = await res.json();
          if (!data.user){
            console.log('no user')
            return
          }
          console.log('[AuthProvider] ✓ setup-user returned user:', data.user.user_name, data.user.email);

          const dbUser: User = {
            id: data.user.id,
            user_name: data.user.user_name,
            email: data.user.email,
            created_at: data.user.created_at,
            image_url: data.user.image_url,
            is_verified: data.user.is_verified,
            last_login: data.user.last_login,
            user_tag: data.user.user_tag,
          };
          dispatch(setUser(dbUser));
          console.log('[AuthProvider] ✓ User dispatched to Redux');
        } catch (err) {
          console.error('[AuthProvider] ✗ Network error calling setup-user:', err);
          dispatch(setUser(null));
        } finally {
          setDbUserFetched(true);
        }
      };
      fetchDbUser();
    } else {
      console.log('[AuthProvider] No clerk user — clearing Redux');
      dispatch(setUser(null));
      setDbUserFetched(true);
    }
  }, [isLoaded, clerkUser, dispatch]);

  const loading = !isLoaded || !dbUserFetched;

  return (
    <AuthContext.Provider value={{ loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
