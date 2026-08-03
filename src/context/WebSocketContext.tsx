import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import type { RootState } from '../store/store';
import type { WebSocketContextValue } from '../../backend/ws/wsTypes';
import { createWsConnection } from '../lib/wsFunctions';

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const user = useSelector((s: RootState) => s.userAuth.user);

  const [socket, setSocket] = useState<WebSocket | null>(null);

  const connection = useMemo(
    () => createWsConnection({ dispatch, queryClient, userId: user ? user.id : null, onSocketChange: setSocket }),
    [dispatch, queryClient, user],
  );

  useEffect(() => {
    if (!user) {
      connection.cleanup();
      return undefined;
    }

    const timer = setTimeout(() => connection.connect(), 100);

    return () => {
      clearTimeout(timer);
      connection.cleanup();
    };
  }, [connection, user]);

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        send: connection.send,
        subscribeToChats: connection.subscribeToChats,
        onMessage: connection.onMessage,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return ctx;
}
