import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setChats } from '../store/chatSlice';
import type { RootState } from '../store/store';

interface ChatContextValue {
  loading: boolean;
  refetchChats: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.userAuth.user);
  const [loading, setLoading] = useState(true);

  const refetchChats = useCallback(async () => {
    if (!user) {
      dispatch(setChats([]));
      return;
    }
    try {
      const res = await fetch('/api/chats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch chats');
      const data = await res.json();
      dispatch(setChats(data.chats));
    } catch {
      dispatch(setChats([]));
    }
  }, [user, dispatch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetchChats().finally(() => setLoading(false));
  }, [refetchChats]);

  return (
    <ChatContext.Provider value={{ loading, refetchChats }}>
      {children}
    </ChatContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChats() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChats must be used within a ChatProvider');
  }
  return ctx;
}
