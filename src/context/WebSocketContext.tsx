/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { setConnected, incrementUnreadNotif } from '../store/userAuthSlice';
import { setOnlineUsers, addOnlineUser, removeOnlineUser, addChat, setChats } from '../store/chatSlice';
import { chatKeys, anonChatKeys, notifKeys } from '../lib/queryKeys';
import type { RootState } from '../store/store';
import type { Chat, ChatMessages, Notification } from '../types/chat';
import type { MessagesResponse } from '../hooks/useChatMessagesQuery';
import type { AnonymousRoom } from '../hooks/useAnonymousRoomsQuery';
import type { WSMessage } from '../types/WsMessageNotification';

type MessageNewPayload = Extract<WSMessage, { type: 'message:new' }>['payload'] & { isEdited?: boolean };

interface WebSocketContextValue {
  socket: WebSocket | null;
  send: (type: string, payload: object) => void;
  subscribeToChats: (chatIds: string[]) => void;
  onMessage: (handler: (msg: WSMessage) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

const WS_URL = import.meta.env.VITE_WS_URL
  ?? (() => { throw new Error('VITE_WS_URL is required'); })();
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
  const connectingRef = useRef(false);

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
    }
  }, []);

  const connect = useCallback(async () => {
    if (!user || connectingRef.current) return;
    connectingRef.current = true;
    cleanup();

    try {
      const res = await fetch(TICKET_ENDPOINT, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to get ticket');
      const { ticket } = await res.json();

      const ws = new WebSocket(`${WS_URL}?ticket=${ticket}`);
      wsRef.current = ws;

      ws.onopen = () => {
        dispatch(setConnected(true));
        const pending = [...subscribedChatsRef.current];
        if (pending.length > 0) {
          ws.send(JSON.stringify({ type: 'subscribe', payload: { chatIds: pending } }));
        }
      };

      type HandlerMap = {
        'chat:online-users': Extract<WSMessage, { type: 'chat:online-users' }>['payload'];
        'user:online': Extract<WSMessage, { type: 'user:online' }>['payload'];
        'user:offline': Extract<WSMessage, { type: 'user:offline' }>['payload'];
        'notification:new': Extract<WSMessage, { type: 'notification:new' }>['payload'];
        'chat:new': Extract<WSMessage, { type: 'chat:new' }>['payload'];
        'message:new': MessageNewPayload;
        'message:delete': Extract<WSMessage, { type: 'message:delete' }>['payload'];
      };

      const handlers: { [K in keyof HandlerMap]: (payload: HandlerMap[K]) => void } = {
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
              id: rest.id,
              chatId,
              senderId: rest.senderId,
              senderName: rest.senderName,
              senderImage: rest.senderImage ?? null,
              content: rest.content,
              createdAt: rest.createdAt,
              isOwn: rest.senderId === user?.id,
              isEdited: rest.isEdited ?? false,
              messageType: rest.messageType ?? 'text',
            };
            if (!old) return { messages: [entry], hasMore: false };
            if (old.messages.some((m) => m.id === entry.id)) return old;
            return { ...old, messages: [...old.messages, entry] };
          });

          const timestamp = new Date(rest.createdAt).getTime();
          const updatedChats = queryClient.setQueryData<Chat[]>(chatKeys.lists(), (old) => {
            if (!old) return old;
            return old.map((chat) =>
              chat.id === chatId
                ? { ...chat, lastMessage: rest.content, timestamp }
                : chat,
            );
          });
          if (updatedChats) {
            dispatch(setChats(updatedChats));
          }

          queryClient.setQueryData<AnonymousRoom[]>(anonChatKeys.lists(), (old) => {
            if (!old) return old;
            return old.map((room) =>
              room.id === chatId
                ? { ...room, lastMessage: rest.content, timestamp }
                : room,
            );
          });
        },

        'message:delete': (payload) => {
          queryClient.setQueryData<MessagesResponse>(chatKeys.messages(payload.chatId), (old) => {
            if (!old) return old;
            return { ...old, messages: old.messages.filter((m) => m.id !== payload.messageId) };
          });
        },
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage;
          switch (msg.type) {
            case 'chat:online-users': handlers['chat:online-users'](msg.payload); break;
            case 'user:online': handlers['user:online'](msg.payload); break;
            case 'user:offline': handlers['user:offline'](msg.payload); break;
            case 'notification:new': handlers['notification:new'](msg.payload); break;
            case 'chat:new': handlers['chat:new'](msg.payload); break;
            case 'message:new': handlers['message:new'](msg.payload); break;
            case 'message:delete': handlers['message:delete'](msg.payload); break;
          }
          messageHandlers.current.forEach((fn) => fn(msg));
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
    } finally {
      connectingRef.current = false;
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
