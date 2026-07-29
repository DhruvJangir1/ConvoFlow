import { createContext, useContext, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { setConnected } from '../store/userAuthSlice';
import { setOnlineUsers, addOnlineUser, removeOnlineUser } from '../store/chatSlice';
import { clerkFetch } from '../lib/clerkFetch';
import { chatKeys, anonChatKeys } from '../lib/queryKeys';
import type { RootState } from '../store/store';
import type { Chat } from '../types/chat';
import type { WSMessage } from '../../backend/ws/wsTypes';
import type { WebSocketContextValue } from '../../backend/ws/wsTypes';
import {
  addMessageToChatCache,
  removeMessageFromChatCache,
  addChatFromWs,
  addMessageToAnonCache,
  removeMessageFromAnonCache,
  addNotificationFromWs,
} from '../hooks/wsCacheHandlers';

type MessageNewPayload = Extract<WSMessage, { type: 'message:new' }>['payload'] & { isEdited?: boolean };

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
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', payload: { chatIds } }));
    }
  }, []);

  const connect = useCallback(async () => {
    if (!user || connectingRef.current) return;
    connectingRef.current = true;
    cleanup();

    try {
      const res = await clerkFetch(TICKET_ENDPOINT);
      if (!res.ok) throw new Error('Failed to get ticket');
      const { ticket } = await res.json();

      const ws = new WebSocket(`${WS_URL}?ticket=${ticket}`);
      wsRef.current = ws;

      ws.onopen = async () => {
        dispatch(setConnected(true));
        console.log('[WS Client] connected');

        try {
          const [chatsRes, anonRes] = await Promise.all([
            clerkFetch('/api/chats'),
            clerkFetch('/api/anonymousChats'),
          ]);

          const standardIds: string[] = chatsRes.ok
            ? ((await chatsRes.json()) as { chats: Array<{ id: string }> }).chats.map((c) => c.id)
            : [];

          const anonIds: string[] = anonRes.ok
            ? ((await anonRes.json()) as { chats: Array<{ id: string }> }).chats.map((r) => r.id)
            : [];

          const allIds = [...new Set([...standardIds, ...anonIds, ...subscribedChatsRef.current])];
          for (const id of allIds) subscribedChatsRef.current.add(id);

          console.log('[WS Client] subscribing to rooms:', allIds.length, 'ids');
          if (allIds.length > 0) {
            ws.send(JSON.stringify({ type: 'subscribe', payload: { chatIds: allIds } }));
          }
          queryClient.invalidateQueries({ queryKey: chatKeys.all });
          queryClient.invalidateQueries({ queryKey: anonChatKeys.all });
        } catch {
          const pending = [...subscribedChatsRef.current];
          console.log('[WS Client] subscribe fetch failed, using pending:', pending.length);
          if (pending.length > 0) {
            ws.send(JSON.stringify({ type: 'subscribe', payload: { chatIds: pending } }));
          }
          queryClient.invalidateQueries({ queryKey: chatKeys.all });
          queryClient.invalidateQueries({ queryKey: anonChatKeys.all });
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

        'notification:new': (payload) => addNotificationFromWs(queryClient, dispatch, payload),

        'chat:new': (payload) => {
          const chat = payload.chat as Chat;
          addChatFromWs(queryClient, dispatch, chat);
          subscribeToChats([chat.id]);
        },

        'message:new': (payload) => {
          if (payload.chatType === 'anonymous') {
            addMessageToAnonCache(queryClient, payload, user.id);
          } else {
            addMessageToChatCache(queryClient, dispatch, payload, user.id);
          }
        },

        'message:delete': (payload) => {
          if (payload.isAnonymous) {
            removeMessageFromAnonCache(queryClient, payload.chatId, payload.messageId);
          } else {2
            removeMessageFromChatCache(queryClient, payload.chatId, payload.messageId);
          }
        },
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage;
          if (msg.type === 'message:new') {
            const sentAt = (msg.payload as { sentAt?: number }).sentAt;
            const receivedAt = Date.now();
            console.log(`[WS Client] message:new RECEIVED: chatId=${(msg.payload as { chatId: string }).chatId} +${sentAt ? receivedAt - sentAt : '?'}ms`);
          }
          switch (msg.type) {
            case 'chat:online-users': handlers['chat:online-users'](msg.payload); break;
            case 'user:online': handlers['user:online'](msg.payload); break;
            case 'user:offline': handlers['user:offline'](msg.payload); break;
            case 'notification:new': handlers['notification:new'](msg.payload); break;
            case 'chat:new': handlers['chat:new'](msg.payload); break;
            case 'message:new': {
              handlers['message:new'](msg.payload);
              const sentAt = (msg.payload as { sentAt?: number }).sentAt;
              console.log(`[WS Client] message:new CACHE_UPDATED: ${Date.now()}ms +${sentAt ? Date.now() - sentAt : '?'}ms`);
              break;
            }
            case 'message:delete': handlers['message:delete'](msg.payload); break;
          }
          messageHandlers.current.forEach((fn) => fn(msg));
        } catch (err){
          console.error(err);
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

  const send = useCallback((type: string, payload: object): boolean => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
      return true;
    }
    return false;
  }, []);


  const onMessage = useCallback((handler: (msg: WSMessage) => void) => {
    messageHandlers.current.add(handler);
    return () => { messageHandlers.current.delete(handler); };
  }, []);

  return (
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