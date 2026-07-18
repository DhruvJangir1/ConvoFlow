import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import { setChats } from '../store/chatSlice';
import { useChatsQuery } from '../hooks/useChatsQuery';
import { useWebSocket } from './WebSocketContext';

interface ChatContextValue {
  loading: boolean;
  refetchChats: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const { data: chats, isLoading, refetch } = useChatsQuery();
  const { subscribeToChats } = useWebSocket();

  useEffect(() => {
    dispatch(setChats(chats ?? []));
  }, [chats, dispatch]);

  useEffect(() => {
    if (chats && chats.length > 0) {
      subscribeToChats(chats.map(c => c.id));
    }
  }, [chats, subscribeToChats]);

  return (
    <ChatContext.Provider value={{ loading: isLoading, refetchChats: () => refetch().then(() => {}) }}>
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
