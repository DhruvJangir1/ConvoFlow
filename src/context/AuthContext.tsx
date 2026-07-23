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
    if (!isLoaded) return;

    if (clerkUser) {
      const fetchDbUser = async () => {
        try {
          const res = await clerkFetch('/api/auth/setup-user', { method: 'POST' });

          if (!res.ok) {
            dispatch(setUser(null));
            setDbUserFetched(true);
            return;
          }

          const data = await res.json();
          if (!data.user) return;

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
        } catch {
          dispatch(setUser(null));
        } finally {
          setDbUserFetched(true);
        }
      };
      fetchDbUser();
    } else {
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
