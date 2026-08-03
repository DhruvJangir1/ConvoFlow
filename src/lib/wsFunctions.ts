import type { QueryClient } from '@tanstack/react-query';
import type { Dispatch } from '@reduxjs/toolkit';
import { setConnected } from '../store/userAuthSlice';
import { clerkFetch } from '../lib/clerkFetch';
import { chatKeys, anonChatKeys } from '../lib/queryKeys';
import type { WSMessage } from '../../backend/ws/wsTypes';
import { createWsHandlers } from '../lib/wsReduxHandlers';

const WS_URL =
  import.meta.env.VITE_WS_URL ??
  (() => {
    throw new Error('VITE_WS_URL is required');
  })();

const TICKET_ENDPOINT = '/api/auth/WsTicketRouter/ws-ticket';
const RECONNECT_DELAY_MS = 2000;

export interface WsConnectionDeps {
  dispatch: Dispatch;
  queryClient: QueryClient;
  userId: string | null;
  onSocketChange: (socket: WebSocket | null) => void;
}

export interface WsConnection {
  connect: () => Promise<void>;
  cleanup: () => void;
  subscribeToChats: (chatIds: string[]) => void;
  send: (type: string, payload: object) => boolean;
  onMessage: (handler: (msg: WSMessage) => void) => () => void;
}

type WsHandlers = ReturnType<typeof createWsHandlers>;

function handleMessage(msg: WSMessage, handlers: WsHandlers) {
  switch (msg.type) {
    case 'chat:online-users':
      handlers['chat:online-users'](msg.payload);
      break;
    case 'user:online':
      handlers['user:online'](msg.payload);
      break;
    case 'user:offline':
      handlers['user:offline'](msg.payload);
      break;
    case 'notification:new':
      handlers['notification:new'](msg.payload);
      break;
    case 'chat:new':
      handlers['chat:new'](msg.payload);
      break;
    case 'message:new':
      handlers['message:new'](msg.payload);
      break;
    case 'message:delete':
      handlers['message:delete'](msg.payload);
      break;
  }
}

export function createWsConnection(deps: WsConnectionDeps): WsConnection {
  const { dispatch, queryClient, userId, onSocketChange } = deps;

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let connecting = false;
  const subscribedChats = new Set<string>();
  const messageHandlers = new Set<(msg: WSMessage) => void>();

  const cleanup = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
      socket = null;
    }
    onSocketChange(null);
    dispatch(setConnected(false));
  };

  const subscribeToChats = (chatIds: string[]) => {
    for (const id of chatIds) subscribedChats.add(id);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'subscribe', payload: { chatIds } }));
    }
  };

  const fetchRoomIds = async (): Promise<string[]> => {
    const res = await clerkFetch('/api/chats/subscribed-ids');
    if (!res.ok) return [...subscribedChats];

    const body = (await res.json()) as { chatIds: string[] };
    return [...new Set([...body.chatIds, ...subscribedChats])];
  };

  const subscribeToRooms = (ws: WebSocket, chatIds: string[]) => {
    for (const id of chatIds) subscribedChats.add(id);
    if (chatIds.length > 0) {
      ws.send(JSON.stringify({ type: 'subscribe', payload: { chatIds } }));
    }
    queryClient.invalidateQueries({ queryKey: chatKeys.all });
    queryClient.invalidateQueries({ queryKey: anonChatKeys.all });
  };

  const scheduleReconnect = () => {
    reconnectTimer = setTimeout(() => connect(), RECONNECT_DELAY_MS);
  };

  const connect = async () => {
    if (!userId || connecting) return;
    connecting = true;
    cleanup();

    const handlers = createWsHandlers({
      dispatch,
      queryClient,
      currentUserId: userId,
      subscribeToChats,
    });

    try {
      const res = await clerkFetch(TICKET_ENDPOINT);
      if (!res.ok) throw new Error('Failed to get ticket');
      const { ticket } = await res.json();

      const ws = new WebSocket(`${WS_URL}?ticket=${ticket}`);
      socket = ws;
      onSocketChange(ws);

      ws.onopen = async () => { // when the connection is established between the browser and the server, do this. and now we can send to the server
        dispatch(setConnected(true));
        console.log('[WS Client] connected');

        try {
          const chatIds = await fetchRoomIds();
          console.log('[WS Client] subscribing to rooms:', chatIds.length, 'ids');
          subscribeToRooms(ws, chatIds);
        } catch {
          console.warn('[WS Client] failed to fetch rooms, subscribing to known rooms');
          subscribeToRooms(ws, [...subscribedChats]);
        }
      };

      ws.onmessage = (event) => { // when the server sends a message
        try {
          const msg = JSON.parse(event.data) as WSMessage;
          handleMessage(msg, handlers);
          messageHandlers.forEach((fn) => fn(msg));
        } catch (err) {
          console.error('[WS Client] failed to handle message:', err);
        }
      };

      ws.onclose = () => {
        dispatch(setConnected(false));
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      scheduleReconnect();
    } finally {
      connecting = false;
    }
  };

  const send = (type: string, payload: object): boolean => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, payload }));
      return true;
    }
    return false;
  };

  const onMessage = (handler: (msg: WSMessage) => void) => {
    messageHandlers.add(handler);
    return () => {
      messageHandlers.delete(handler);
    };
  };

  return { connect, cleanup, subscribeToChats, send, onMessage };
}
