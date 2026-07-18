/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { setConnected, incrementUnreadNotif } from '../store/userAuthSlice';
import { setOnlineUsers, addOnlineUser, removeOnlineUser, addChat } from '../store/chatSlice';
import { chatKeys, notifKeys } from '../lib/queryKeys';
import type { RootState } from '../store/store';
import type { Chat, ChatMessages, Notification } from '../types/chat';
import type { MessagesResponse } from '../hooks/useChatMessagesQuery';
import type { WSMessage } from '../types/WsMessageNotification';

interface WebSocketContextValue {
  socket: WebSocket | null;
  send: (type: string, payload: object) => void;
  subscribeToChats: (chatIds: string[]) => void;
  onMessage: (handler: (msg: WSMessage) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

const WS_URL = 'ws://localhost:8080/ws';
const TICKET_ENDPOINT = '/api/auth/WsTicketRouter/ws-ticket';
const RECONNECT_DELAY_MS = 2000;

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const user = useSelector((s: RootState) => s.userAuth.user);
  
  const messageHandlers = useRef<Set<(msg: WSMessage) => void>>(new Set());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const subscribedChatsRef = useRef<Set<string>>(new Set());
  const connectRef = useRef<() => Promise<void>>(() => Promise.resolve());

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


    const subscribeToChats = useCallback((chatIds: string[]) => {
    for (const id of chatIds) subscribedChatsRef.current.add(id);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', payload: { chatIds } }));
    } else {
      const interval = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'subscribe', payload: { chatIds } }));
          clearInterval(interval);
        }
      }, 100);
      setTimeout(() => clearInterval(interval), 10_000);
    }
  }, []);


  const connect = useCallback(async () => {
    if (!user) return;
    cleanup();

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

      const handlers: Record<string, (payload: any) => void> = {
        'chat:online-users': (payload) => dispatch(setOnlineUsers(payload)),
        'user:online': (payload) => dispatch(addOnlineUser(payload)),
        'user:offline': (payload) => dispatch(removeOnlineUser(payload)),

        'notification:new': (payload) => {
          dispatch(incrementUnreadNotif());
          queryClient.setQueryData<Notification[]>(notifKeys.lists(), (old) =>
            old ? [payload, ...old.filter((n) => n.id !== payload.id)] : [payload],
          );
        },

        'chat:new': (payload) => {
          const newChatId = payload.chat.id;
          dispatch(addChat(payload.chat));
          queryClient.setQueryData<Chat[]>(chatKeys.lists(), (old) =>
            old ? [payload.chat, ...old.filter((c) => c.id !== newChatId)] : [payload.chat],
          );
          subscribeToChats([newChatId]);
        },

        'message:new': (payload) => {
          const { chatId, ...rest } = payload;
          queryClient.setQueryData<MessagesResponse>(chatKeys.messages(chatId), (old) => {
            const entry: ChatMessages = {
              ...rest,
              isOwn: rest.senderId === user?.id,
              senderImage: rest.senderImage ?? null,
              isEdited: rest.isEdited ?? false,
              messageType: rest.messageType ?? 'text',
            };
            if (!old) return { messages: [entry], hasMore: false };
            if (old.messages.some((m) => m.id === entry.id)) return old;
            return { ...old, messages: [...old.messages, entry] };
          });
          queryClient.setQueryData<Chat[]>(chatKeys.lists(), (old) =>
            old?.map((chat) =>
              chat.id === chatId
                ? { ...chat, lastMessage: rest.content, timestamp: new Date(rest.createdAt).getTime() }
                : chat,
            ),
          );
        },
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage;
          handlers[msg.type]?.(msg.payload);
          messageHandlers.current.forEach((handler) => handler(msg));
        } catch {
          /* ignore malformed */
        }
      };

      ws.onclose = () => {
        dispatch(setConnected(false));
        reconnectTimer.current = setTimeout(() => connectRef.current(), RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimer.current = setTimeout(() => connectRef.current(), RECONNECT_DELAY_MS);
    }
  }, [user, cleanup, dispatch, queryClient, subscribeToChats]);

  connectRef.current = connect;

  useEffect(() => {
   if (user) {
    const timer = setTimeout(() => connect(), 100); 
    return () => clearTimeout(timer);
  } else {
    cleanup();

    }
    return () => cleanup();
  }, [cleanup, connect, user]);

  const send = useCallback((type: string, payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);


  const onMessage = useCallback((handler: (msg: WSMessage) => void) => {
    messageHandlers.current.add(handler);
    return () => { messageHandlers.current.delete(handler); };
  }, []);

  return (
    // eslint-disable-next-line react-hooks/refs
    <WebSocketContext.Provider value={{ socket: wsRef.current, send, subscribeToChats, onMessage }}>
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
