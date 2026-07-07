import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import { setChats } from '../store/chatSlice';
import { useChatsQuery } from '../hooks/useChatsQuery';

interface ChatContextValue {
  loading: boolean;
  refetchChats: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const { data: chats, isLoading, refetch } = useChatsQuery();

  useEffect(() => {
    dispatch(setChats(chats ?? []));
  }, [chats, dispatch]);

  return (
    <ChatContext.Provider value={{ loading: isLoading, refetchChats: refetch }}>
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
