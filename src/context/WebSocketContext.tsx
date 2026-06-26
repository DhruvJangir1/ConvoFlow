/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setConnected, incrementUnreadNotif } from '../store/userAuthSlice';
import { setOnlineUsers, addOnlineUser, removeOnlineUser, addChat } from '../store/chatSlice';
import type { RootState } from '../store/store';

interface NotificationPayload {
  id: string;
  created_at: string;
  receiver_user_id: string;
  sender_user_id: string;
  type: string;
  content: string | null;
  read_at: string | null;
  entity_id: string;
}

type WSMessage =
  | { type: 'message:new'; payload: { id: string; chatId: string; senderId: string; senderName: string; senderImage: string | null; content: string; createdAt: string } }
  | { type: 'message:ack'; payload: { id: string; tempId?: string } }
  | { type: 'typing:update'; payload: { chatId: string; userId: string; isTyping: boolean } }
  | { type: 'subscribed'; payload: { chatIds: string[] } }
  | { type: 'unsubscribed'; payload: { chatIds: string[] } }
  | { type: 'user:online'; payload: { chatId: string; userId: string } }
  | { type: 'user:offline'; payload: { chatId: string; userId: string } }
  | { type: 'chat:online-users'; payload: { chatId: string; userIds: string[] } }
  | { type: 'notification:new'; payload: NotificationPayload }
  | { type: 'chat:new'; payload: { chat: { id: string; name: string; avatar_url: string | null; lastMessage: string; timestamp: number; unread: number; type: string; messageCount: number; members: { id: string; user_name: string; image_url: string | null }[] } } }
  | { type: 'error'; payload: { message: string } };
  
  interface WebSocketContextValue {
  socket: WebSocket | null;
  send: (type: string, payload: object) => void;
  subscribeToChats: (chatIds: string[]) => void;
  unsubscribeFromChats: (chatIds: string[]) => void;
  onMessage: (handler: (msg: WSMessage) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

const WS_URL = 'ws://localhost:8080/ws';
const TICKET_ENDPOINT = '/api/auth/WsTicketRouter/ws-ticket';
const RECONNECT_DELAY_MS = 2000;

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.userAuth.user);
  
  const messageHandlers = useRef<Set<(msg: WSMessage) => void>>(new Set());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const subscribedChatsRef = useRef<Set<string>>(new Set());

  const cleanup = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    dispatch(setConnected(false));
  }, [dispatch]);

  const connect = useCallback(async () => {

    if (!user) return;

    try {
      console.log('[WS] Fetching ticket from', TICKET_ENDPOINT);
      const res = await fetch(TICKET_ENDPOINT, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to get ticket');
      const { ticket } = await res.json();
      console.log('[WS] Ticket received, connecting to', WS_URL);

      const ws = new WebSocket(`${WS_URL}?ticket=${ticket}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connection established successfully');
        dispatch(setConnected(true));
        const pending = [...subscribedChatsRef.current];
        if (pending.length > 0) {
          ws.send(JSON.stringify({ type: 'subscribe', payload: { chatIds: pending } }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage;
          // Update online users state
          if (msg.type === 'chat:online-users') {
            dispatch(setOnlineUsers(msg.payload));
          } else if (msg.type === 'user:online') {
            dispatch(addOnlineUser(msg.payload));
          } else if (msg.type === 'user:offline') {
            dispatch(removeOnlineUser(msg.payload));
          } else if (msg.type === 'notification:new') {
            console.log('[WS] notification:new received');
            dispatch(incrementUnreadNotif());
          } else if (msg.type === 'chat:new') {
            console.log('[WS] chat:new received');
            dispatch(addChat(msg.payload.chat));
          }
          messageHandlers.current.forEach((handler) => handler(msg));
        } catch {
          /* ignore malformed */
        }
      };

      ws.onclose = () => {
        dispatch(setConnected(false));
        if (user) {
          reconnectTimer.current = setTimeout(cleanup, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      if (user) {
        reconnectTimer.current = setTimeout(cleanup, RECONNECT_DELAY_MS);
      }
    }
  }, [user, cleanup, dispatch]);

  useEffect(() => {
    if (user) {
      connect();
    } 
    else {
      cleanup();
    }
    return cleanup;
  }, [user, connect, cleanup]);

  const send = useCallback((type: string, payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const subscribeToChats = useCallback((chatIds: string[]) => {
    for (const id of chatIds) subscribedChatsRef.current.add(id);
    send('subscribe', { chatIds });
  }, [send]);

  const unsubscribeFromChats = useCallback((chatIds: string[]) => {
    for (const id of chatIds) subscribedChatsRef.current.delete(id);
    send('unsubscribe', { chatIds });
  }, [send]);

  const onMessage = useCallback((handler: (msg: WSMessage) => void) => {
    messageHandlers.current.add(handler);
    return () => { messageHandlers.current.delete(handler); };
  }, []);

  return (
    // eslint-disable-next-line react-hooks/refs
    <WebSocketContext.Provider value={{ socket: wsRef.current, send, subscribeToChats, unsubscribeFromChats, onMessage }}>
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
