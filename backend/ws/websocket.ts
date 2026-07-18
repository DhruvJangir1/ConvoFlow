import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import type { IncomingMessage } from 'http';
import { consumeTicket, startTicketCleanup, stopTicketCleanup } from '../src/services/wsTicketStore';
import { prisma } from '../src/lib/connectionPoolClient';



interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  userName?: string;
  userImage?: string | null;
  isAlive?: boolean;
  subscribedRooms?: Set<string>;
}

type ClientMessage =
  | { type: 'subscribe'; payload: { chatIds: string[] } }
  | { type: 'unsubscribe'; payload: { chatIds: string[] } }
  | { type: 'message:send'; payload: { chatId: string; content: string } }
  | { type: 'typing:start'; payload: { chatId: string } }
  | { type: 'typing:stop'; payload: { chatId: string } };

const userSockets = new Map<string, AuthenticatedSocket>();
const chatRooms = new Map<string, Set<AuthenticatedSocket>>();
let wss: WebSocketServer | null = null;

// ─── MODULE LOADED ───────────────────────────────────────────────
console.log('[ws-module] websocket.ts module loaded (before any function runs)');

function authenticateConnection(request: IncomingMessage): string | null {
  const urlString = request.url;
  if (urlString === undefined) {
    console.log('[ws-auth] No URL in request');
    return null;
  }
  const url = new URL(urlString, 'http://localhost');
  const ticket = url.searchParams.get('ticket');
  if (ticket === null) {
    console.log('[ws-auth] No ticket in URL params');
    return null;
  }
  console.log(`[ws-auth] Consuming ticket: ${ticket}`);
  const userId = consumeTicket(ticket);
  if (userId) {
    console.log(`[ws-auth] Ticket valid for user ${userId}`);
  } else {
    console.log(`[ws-auth] Ticket invalid or expired: ${ticket}`);
  }
  return userId;
}

function getOnlineUsersInChat(chatId: string): string[] {
  const sockets = chatRooms.get(chatId);
  if (!sockets) return [];
  return [...sockets]
    .map((s) => s.userId)
    .filter((id): id is string => id !== undefined);
}

export function broadcastToRoom(chatId: string, data: object): void {
  const room = chatRooms.get(chatId);
  console.log(`[ws:broadcast] Broadcasting to room "${chatId}" — ${room ? room.size : 0} sockets in room`);
  if (!room) {
    console.log(`[ws:broadcast] Room "${chatId}" doesn't exist or is empty, skipping`);
    return;
  }
  if (!room) return;
  for (const ws of room) { // send to every single connected one in a given chat
    if(ws && ws.userId){
      sendToUser(ws.userId,data);
    }
  }
}

export function sendToUser(userId: string, data: object): void {
  const ws = userSockets.get(userId);
  console.log(`[ws:sendToUser] looking for socket for user ${userId} — found: ${!!ws}, open: ${ws?.readyState === WebSocket.OPEN}`);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    console.log(`[ws:sendToUser] message sent to user ${userId}, type: ${(data as { type?: string }).type}`);
  }
}

function sendToSocket(ws: AuthenticatedSocket, data: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function addToRoom(ws: AuthenticatedSocket, chatId: string): void {
  if (!chatRooms.has(chatId)) {
    chatRooms.set(chatId, new Set());
    console.log(`[ws:room] Created new room "${chatId}"`);
  }

  const room = chatRooms.get(chatId);
  if (room !== undefined) {
    room.add(ws);
    console.log(`[ws:room] Added user ${ws.userId} to room "${chatId}" (${room.size} sockets in room)`);
  }

  if (ws.subscribedRooms === undefined) {
    ws.subscribedRooms = new Set();
  }
  ws.subscribedRooms.add(chatId);
}

function removeFromRoom(ws: AuthenticatedSocket, chatId: string): void {
  const room = chatRooms.get(chatId);
  if (room !== undefined) {
    room.delete(ws);
    console.log(`[ws:room] Removed user ${ws.userId} from room "${chatId}" (${room.size} remaining)`);
  }
  if (ws.subscribedRooms !== undefined) {
    ws.subscribedRooms.delete(chatId);
  }
}

export function removeSocketFromAllRooms(ws: AuthenticatedSocket): void {
  if (ws.subscribedRooms === undefined) {
    return;
  }
  const roomIds = [...ws.subscribedRooms];
  console.log(`[ws:room] Removing user ${ws.userId} from all ${roomIds.length} rooms`);
  for (const chatId of roomIds) {
    const room = chatRooms.get(chatId);
    if (room !== undefined) {
      room.delete(ws);
      console.log(`[ws:room] Cleaned user ${ws.userId} from room "${chatId}" (${room.size} remaining)`);
    }
  }
  ws.subscribedRooms.clear();
}

export async function handleSendMessage(ws: AuthenticatedSocket, payload: { chatId: string; content: string; tempId?: string }): Promise<void> {
  const { chatId, content, tempId } = payload;
  console.log(`[ws:message] User ${ws.userId} sending message to chat "${chatId}": "${content?.substring(0, 30)}..."`);

  if (ws.userId === undefined) {
    console.log('[ws:message] REJECTED — userId is undefined');
    sendToSocket(ws, { type: 'error', payload: { message: 'Not authenticated' } });
    return;
  }

  if (ws.userName === undefined) {
    console.log('[ws:message] REJECTED — userName is undefined');
    sendToSocket(ws, { type: 'error', payload: { message: 'Not authenticated' } });
    return;
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    console.log('[ws:message] REJECTED — empty content');
    sendToSocket(ws, { type: 'error', payload: { message: 'content must be a non-empty string' } });
    return;
  }

  try {
    const message = await prisma.standardChatMessages.create({
      data: { chat_id: chatId, sender_id: ws.userId, content },
    });
    console.log(`[ws:message] Message ${message.id} saved to DB`);

    await prisma.standardChats.update({
      where: { id: chatId },
      data: { updated_at: new Date() },
    });

    sendToSocket(ws, { type: 'message:ack', payload: { id: message.id, tempId } });
    console.log(`[ws:message] Sent ack for message ${message.id} to sender`);

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: {
        id: message.id,
        chatId,
        senderId: ws.userId,
        senderName: ws.userName,
        senderImage: ws.userImage ?? null,
        content: message.content,
        createdAt: message.created_at,
      },
    });

    console.log(`[ws:message] Message ${message.id} broadcast complete`);

  } catch (error) {
    console.error('[ws:message] ERROR:', error);
    sendToSocket(ws, { type: 'error', payload: { message: 'Failed to send message' } });
  }
}

function handleTyping(ws: AuthenticatedSocket, type: 'typing:start' | 'typing:stop', payload: { chatId: string }): void {
  if (ws.userId === undefined) {
    return;
  }
  broadcastToRoom(payload.chatId, {
    type: 'typing:update',
    payload: { chatId: payload.chatId, userId: ws.userId, isTyping: type === 'typing:start' },
  });
}

function handleSubscribe(ws: AuthenticatedSocket, chatIds: string[]): void {
  console.log(`[ws:subscribe] User ${ws.userId} subscribing to chats: ${chatIds}`);
  if (ws.userId === undefined) {
    console.log('[ws:subscribe] REJECTED — userId is undefined');
    return;
  }

  for (const id of chatIds) {
    addToRoom(ws, id);
  }
  sendToSocket(ws, { type: 'subscribed', payload: { chatIds } });
  console.log(`[ws:subscribe] Confirmed subscription to ${chatIds}`);

  for (const id of chatIds) {
    broadcastToRoom(id, {
      type: 'user:online',
      payload: { chatId: id, userId: ws.userId },
    });
    sendToSocket(ws, {
      type: 'chat:online-users',
      payload: { chatId: id, userIds: getOnlineUsersInChat(id) },
    });
  }
}

function handleUnsubscribe(ws: AuthenticatedSocket, chatIds: string[]): void {
  console.log(`[ws:unsubscribe] User ${ws.userId} unsubscribing from chats: ${chatIds}`);
  if (ws.userId === undefined) {
    return;
  }

  for (const id of chatIds) {
    removeFromRoom(ws, id);
    broadcastToRoom(id, {
      type: 'user:offline',
      payload: { chatId: id, userId: ws.userId },
    });
  }
  sendToSocket(ws, { type: 'unsubscribed', payload: { chatIds } });
}

function handleMessage(ws: AuthenticatedSocket, raw: Buffer): void {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    console.log(`[ws:message] INVALID JSON from user ${ws.userId}`);
    sendToSocket(ws, { type: 'error', payload: { message: 'Invalid JSON' } });
    return;
  }

  console.log(`[ws:message] Received type="${msg.type}" from user ${ws.userId}`);

  switch (msg.type) {
    case 'subscribe':
      handleSubscribe(ws, msg.payload.chatIds);
      break;

    case 'unsubscribe':
      handleUnsubscribe(ws, msg.payload.chatIds);
      break;

    case 'message:send':
      handleSendMessage(ws, msg.payload);
      break;

    case 'typing:start':
    case 'typing:stop':
      handleTyping(ws, msg.type, msg.payload);
      break;

    default:
      console.log(`[ws:message] Unknown message type: ${(msg as unknown as { type: string }).type}`);
      sendToSocket(ws, { type: 'error', payload: { message: `Unknown type: ${(msg as unknown as { type: string }).type}` } });
  }
}

function handleClose(ws: AuthenticatedSocket): void {
  const userId = ws.userId;
  console.log(`[ws:close] Socket closing for user ${userId || 'unknown'}`);

  if (ws.subscribedRooms !== undefined && ws.subscribedRooms.size > 0) {
    const rooms = [...ws.subscribedRooms];
    console.log(`[ws:close] User ${userId} was in ${rooms.length} rooms, cleaning up`);
    removeSocketFromAllRooms(ws);

    for (const chatId of rooms) {
      broadcastToRoom(chatId, {
        type: 'user:offline',
        payload: { chatId, userId: userId },
      });
    }
  }

  if (userId !== undefined) {
    userSockets.delete(userId);
    console.log(`[ws:close] User ${userId} fully disconnected (${userSockets.size} sockets remaining)`);
  }
}

function startHeartbeat(): void {
  console.log('[ws:heartbeat] Starting heartbeat interval (30s)');
  const interval = setInterval(() => {
    if (wss !== null) {
      console.log(`[ws:heartbeat] Ping check — ${wss.clients.size} connected clients`);
      wss.clients.forEach((client) => {
        const ws = client as AuthenticatedSocket;
        if (ws.isAlive === false) {
          console.log(`[ws:heartbeat] Terminating stale client ${ws.userId}`);
          ws.terminate();
          return;
        }
        ws.isAlive = false;
        ws.ping();
      });
    }
  }, 30_000);
  if (wss !== null) {
    wss.on('close', () => clearInterval(interval));
  }
}

const WS_PORT = 8080;

export function setupWebSocket(): WebSocketServer {
  console.log('[ws:setup] ===== SETUP WEBSOCKET CALLED =====');
  console.log('[ws:setup] Creating raw HTTP server for WS');

  const server = http.createServer();
  console.log('[ws:setup] Creating WebSocketServer on path /ws');

  wss = new WebSocketServer({ server, path: '/ws' });
  console.log('[ws:setup] WebSocketServer instance created, registering connection handler');

  wss.on('connection', async (ws: AuthenticatedSocket, request: IncomingMessage) => {
    console.log('[ws:setup] *** NEW CONNECTION RECEIVED ***');
    console.log(`[ws:setup] Request URL: ${request.url}`);

    const userId = authenticateConnection(request);
    if (!userId) {
      console.log('[ws:setup] Authentication FAILED — closing socket with code 4001');
      ws.close(4001, 'Authentication required');
      return;
    }

    console.log(`[ws:setup] Authentication SUCCESS — user ID: ${userId}`);

    ws.userId = userId;
    ws.isAlive = true;
    ws.subscribedRooms = new Set();

    console.log(`[ws:setup] Fetching user profile from DB for ${userId}`);
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { user_name: true, image_url: true },
      });
      if (user !== null) {
        ws.userName = user.user_name;
        ws.userImage = user.image_url;
        console.log(`[ws:setup] User profile loaded: name="${user.user_name}"`);
      } else {
        ws.userName = userId;
        ws.userImage = null;
        console.log(`[ws:setup] No user profile found, using ID as name`);
      }
    } catch {
      ws.userName = userId;
      ws.userImage = null;
      console.log(`[ws:setup] DB error loading profile, using ID as name`);
    }

    userSockets.set(userId, ws);
    console.log(`[ws:setup] Socket stored for ${ws.userName} (${userId}) — ${userSockets.size} total unique users connected`);

    // Register socket-level event listeners
    console.log(`[ws:setup] Registering event listeners on socket for ${userId}`);

    ws.on('pong', () => {
      console.log(`[ws:pong] Received pong from ${ws.userId}`);
      ws.isAlive = true;
    });

    ws.on('message', (raw: Buffer) => {
      console.log(`[ws:setup] Raw message received from ${ws.userId}: ${raw.toString().substring(0, 80)}`);
      handleMessage(ws, raw);
    });

    ws.on('close', () => {
      console.log(`[ws:setup] Socket 'close' event fired for ${ws.userId}`);
      handleClose(ws);
    });

    ws.on('error', (err) => {
      console.log(`[ws:setup] Socket 'error' event for ${ws.userId}: ${err}`);
      handleClose(ws);
    });

    console.log(`[ws:setup] === CONNECTION FULLY ESTABLISHED for ${ws.userName} (${userId}) ===`);
  });

  server.listen(WS_PORT, '0.0.0.0', () => {
    console.log(`[ws:setup] ===== WS SERVER LISTENING on ws://localhost:${WS_PORT}/ws =====`);
  });

  console.log('[ws:setup] Starting ticket cleanup & heartbeat');
  startTicketCleanup();
  startHeartbeat();
  console.log('[ws:setup] ===== SETUP WEBSOCKET COMPLETE =====');
  return wss;
}

export function shutdownWebSocket(): void {
  console.log('[ws:shutdown] Shutting down WebSocket server...');
  stopTicketCleanup();
  if (wss !== null) {
    const count = wss.clients.size;
    console.log(`[ws:shutdown] Closing ${count} active client connections`);
    wss.clients.forEach((c) => c.close(1001, 'Server shutting down'));
    wss.close();
    console.log('[ws:shutdown] WebSocket server closed');
  }
}
