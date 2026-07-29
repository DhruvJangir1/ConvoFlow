import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { consumeTicket, startTicketCleanup, stopTicketCleanup } from '../src/services/wsTicketStore.js';
import { prisma } from '../src/lib/connectionPoolClient.js';
import { insertStandardChatMessage, requireChatMembership } from '../src/services/chatMessageService.js';
import type { MessageSendPayload, SubscribePayload, WsClientMessage } from './wsTypes.js';

interface AuthenticatedSocket extends WebSocket { // this type helps for sending messages fast and keep up with user's other needed data to not lookup in the DB
  userId: string;
  userName: string;
  userImage: string | null;
  isAlive: boolean;
  subscribedRooms: Set<string>;
}

const userSockets = new Map<string, AuthenticatedSocket[]>();
const chatRooms = new Map<string, Set<AuthenticatedSocket>>();

let wss: WebSocketServer | null = null;

export function authenticateConnection(url: string): string | null { // this consumes the wsTicket from a user, and makes sure we authenticate him, and returns his id
  try {
    const backendUrl = process.env.RENDER_API_URL ?? 'http://localhost';
    const parsed = new URL(url, backendUrl);
    const ticket = parsed.searchParams.get('ticket');
    if (!ticket) return null;
    const userId = consumeTicket(ticket);
    return userId;
  } catch {
    return null
  }
}

export function sendMessageToUser(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}


export function broadcastToRoom(chatId: string, data: Record<string, unknown>): void {
  const room = chatRooms.get(chatId);
  if (!room) return;
  const payload = JSON.stringify(data);

  let sent = 0;

  for (const member of room) {
    if (member.readyState === WebSocket.OPEN) {
      member.send(payload);
      sent++;
    }
  }
  console.log(`[WS] broadcastMessageToRoom: chatId=${chatId} roomSize=${room.size} sent=${sent}`)
}

export function sendToUser(userId: string, data: Record<string, unknown>): void {
  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const ws of sockets) {
      sendMessageToUser(ws, data);
    }
  }
}

export function broadcastMessageToRoom(chatId: string, buf: Buffer, isBinary: boolean): void {
  const room = chatRooms.get(chatId);
  if (!room) return;
  for (const member of room) {
    if (member.readyState === WebSocket.OPEN) {
      member.send(buf, { binary: isBinary });
    }
  }
}

export function removeSocketFromAllRooms(ws: AuthenticatedSocket): void {
  if (!ws.subscribedRooms) return;
  for (const chatId of ws.subscribedRooms) {
    unsubscribeFromRoom(chatId, ws);
    if (ws.userId) {
      broadcastToRoom(chatId, { type: 'user:offline', payload: { chatId, userId: ws.userId } });
    }
  }
  ws.subscribedRooms.clear();
}

export async function handleSendMessage(ws: AuthenticatedSocket, payload: { chatId: string; content: string; sentAt?: number; tempId?: string }): Promise<void> {
  if (!ws.userId) return;
  const { chatId, content, sentAt, tempId } = payload;

  if (!content || typeof content !== 'string' || !content.trim()) return;
  if (!chatId || chatId === '') return;

  const receivedAt = Date.now();

  const isMember = await requireChatMembership(ws.userId, chatId);
  if (!isMember) return;

  const newMessageId = crypto.randomUUID();
  const dbStart = Date.now();
  const { id, createdAt } = await insertStandardChatMessage(newMessageId, chatId, ws.userId, content.trim());
  const dbTime = Date.now() - dbStart;

  prisma.standardChats.update({
    where: { id: chatId },
    data: { updated_at: new Date() },
  });

  sendMessageToUser(ws, { type: 'message:ack', payload: { id, tempId } });

  broadcastToRoom(chatId, {
    type: 'message:new',
    payload: {
      id,
      chatId,
      senderId: ws.userId,
      senderName: ws.userName || ws.userId.slice(0, 8),
      senderImage: ws.userImage ?? null,
      content: content.trim(),
      createdAt,
      isEdited: false,
      isAnonymous: false,
      messageType: 'text',
      sentAt,
      chatType: 'standard',
    },
  });

  const total = Date.now() - receivedAt;
  console.log(`[WS] handleSendMessage: chatId=${chatId} dbTime=${dbTime}ms total=${total}ms +${sentAt ? Date.now() - sentAt : '?'}ms`);
}

export function subscribeToRoom(chatId:string,userId:string, ws: AuthenticatedSocket){
  if (!userSockets.has(userId)){
    userSockets.set(userId,[ws]);
  }

  ws.subscribedRooms.add(chatId);
  const existingChatUsersSet = chatRooms.get(chatId);

  if (existingChatUsersSet){
    existingChatUsersSet.add(ws);
    chatRooms.set(chatId,existingChatUsersSet);
    return;
  }

  const newSet = new Set<AuthenticatedSocket>();
  newSet.add(ws);

  chatRooms.set(chatId,newSet);
}

function unsubscribeFromRoom(chatId: string, ws: AuthenticatedSocket): void {
  ws.subscribedRooms.delete(chatId);
  const room = chatRooms.get(chatId);

  if (!room) return;

  room.delete(ws);
  if (room.size === 0) chatRooms.delete(chatId);
}

export function createWebSocketServer(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });
  startTicketCleanup();

  wss.on('connection', async (ws: AuthenticatedSocket, req) => {
    const url = req.url ?? '';
    const userId = authenticateConnection(url);

    if (!userId) {
      ws.close(4001, 'Invalid or expired ticket');
      return;
    }

    ws.userId = userId;
    ws.isAlive = true;
    ws.subscribedRooms = new Set();

    console.log(`[WS] connection: userId=${userId}`);

    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { user_name: true, image_url: true },
      });
      if (user) {
        ws.userName = user.user_name || userId.slice(0, 8);
        ws.userImage = user.image_url;
      } else {
        ws.userName = userId.slice(0, 8);
        ws.userImage = null;
      }
    } catch (err){
      console.error(err)
    }

    const existing = userSockets.get(userId);
    if (existing) {
      existing.push(ws);
    } else {
      userSockets.set(userId, [ws]);
    }
    console.log(`[WS] connection complete: userId=${userId} userName=${ws.userName} totalUserSockets=${userSockets.size}`);

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsClientMessage
    
        switch (msg.type) {
          case 'subscribe': {
            const chatIds = msg.payload.chatIds;
            if (!Array.isArray(chatIds)) break;

            const [standardMemberships, anonMemberships] = await Promise.all([
              prisma.standardChatMembers.findMany({
                where: { user_id: userId, chat_id: { in: chatIds } },
                select: { chat_id: true },
              }),
              prisma.anonymousChatMembers.findMany({
                where: { id: userId, chat_id: { in: chatIds } },
                select: { chat_id: true },
              }),
            ]);
            const validIds = new Set([
              ...standardMemberships.map((m) => m.chat_id),
              ...anonMemberships.map((m) => m.chat_id),
            ]);

            for (const chatId of chatIds) {
              if (!validIds.has(chatId)) continue;
              subscribeToRoom(chatId,userId,ws);
              broadcastToRoom(chatId, { type: 'user:online', payload: { chatId, userId } });

              const memberSockets = chatRooms.get(chatId);
              const userIds = [];
              if (memberSockets) {
                for (const memberSocket of memberSockets) {
                  if (memberSocket.userId) {
                    userIds.push(memberSocket.userId);
                  }
                }
              }
              sendMessageToUser(ws, { type: 'chat:online-users', payload: { chatId, userIds } });
            }
            sendMessageToUser(ws, { type: 'subscribed', payload: { chatIds } });
            break;
          }
          case 'unsubscribe': {
            const chatIds = msg.payload.chatIds;
            if (!Array.isArray(chatIds)) break;
            for (const chatId of chatIds) {
              unsubscribeFromRoom(chatId, ws);
              broadcastToRoom(chatId, { type: 'user:offline', payload: { chatId, userId } });
            }
            sendMessageToUser(ws, { type: 'unsubscribed', payload: { chatIds } });
            break;
          }
          case 'message:send': {
            const msgPayload = msg.payload as MessageSendPayload;
            await handleSendMessage(ws, msgPayload);
            break;
          }
        }
      } catch (err){
        console.error(err);
      }
    });

    function removeSocket() {
      removeSocketFromAllRooms(ws);
      if (!userId){
        console.log('[websockets/removeSocket] couldnt find userId')
        return;
      }
      const sockets = userSockets.get(userId);
      if (sockets) {
        const idx = sockets.indexOf(ws);
        if (idx >= 0) sockets.splice(idx, 1);
        if (sockets.length === 0) userSockets.delete(userId);
      }
    }

    ws.on('close', () => {
      console.log(`[WS] disconnect: userId=${userId}`);
      removeSocket();
    });

    ws.on('error', () => {
      removeSocket();
    });
  });

  const heartbeat = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedSocket;
      if (!authWs.isAlive) { 
        authWs.terminate(); 
        return; 
      }
      authWs.isAlive = false;
      authWs.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));
}

export function shutdownWebSocket(): void {
  stopTicketCleanup();
  if (wss) {
    wss.close();
    wss = null;
  }
}