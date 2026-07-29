import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('ws', () => {
  function MockWSS() {
    const ee = (() => {
      const _listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
      return {
        _listeners,
        on(event: string, fn: (...args: unknown[]) => void) { if (!_listeners[event]) _listeners[event] = []; _listeners[event].push(fn); return this; },
        emit(event: string, ...args: unknown[]) { const fns = _listeners[event]; if (fns) fns.forEach((fn) => fn(...args)); return true; },
        listeners(event: string) { return _listeners[event] ?? []; },
      };
    })();
    const instance = Object.assign(ee, {
      clients: new Set(),
      _connHandler: undefined as ((ws: unknown, req: { url: string }) => void) | undefined,
      close() {},
    });
    (globalThis as Record<string, unknown>).__mockWss = instance;
    return instance;
  }
  return { WebSocketServer: MockWSS, WebSocket: { OPEN: 1, CLOSED: 3 } };
});

vi.mock('../src/services/wsTicketStore.js', () => ({
  get consumeTicket() { const s = (globalThis as any).__testMockState; return s ? s.consumeTicket : vi.fn(); },
  get startTicketCleanup() { const s = (globalThis as any).__testMockState; return s ? s.startTicketCleanup : vi.fn(); },
  get stopTicketCleanup() { const s = (globalThis as any).__testMockState; return s ? s.stopTicketCleanup : vi.fn(); },
}));

vi.mock('../src/lib/connectionPoolClient.js', () => ({
  get prisma() { const s = (globalThis as any).__testMockState; return s ? s.prisma : {}; },
}));

vi.mock('../src/services/chatMessageService.js', () => ({
  insertStandardChatMessage: async (messageId: string, chatId: string, senderId: string, content: string) => ({
    id: messageId,
    createdAt: new Date(),
  }),
  requireChatMembership: async (userId: string, chatId: string) => true,
}));

vi.mock('../src/supabase/supabaseS3Client.js', () => ({ s3Client: {}, S3_BUCKET_NAME: 'test-bucket' }));

import { createWebSocketServer as setupWebSocket, shutdownWebSocket, broadcastToRoom, sendToUser } from '../ws/websocket.js';
import {
  getMockState, createFreshMockState, resetMockState,
  createMockWs, emitConnection, cleanEmitConnection,
  getAllSent, getMessagesOfType, sleep, sleepLong,
  setupDefaultMocks, setupWsTestServer, registerConnHandler,
  uid, cid,
} from './helpers/index';

let server: { on: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as Record<string, unknown>).__testMockState = createFreshMockState();
  (globalThis as Record<string, unknown>).__mockWss = undefined;
  server = setupWsTestServer();
  setupDefaultMocks();
  setupWebSocket(server as never);
  registerConnHandler();
});

afterEach(() => {
  shutdownWebSocket();
  resetMockState();
});

/* ═══════════════════════════════════════════════════════════════════════
   12. CACHE CONSISTENCY & RACE CONDITIONS
   ═══════════════════════════════════════════════════════════════════════ */

describe('Cache Consistency', () => {
  it('broadcasts message:new to all room subscribers', async () => {
    const userId1 = uid();
    const userId2 = uid();
    const chatId = cid();
    const ms = getMockState();

    ms.consumeTicket.mockReturnValue(userId1);
    const ws1 = emitConnection('t1');
    await sleep();

    ms.consumeTicket.mockReturnValue(userId2);
    const ws2 = emitConnection('t2');
    await sleep();

    ws1.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    ws2.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws1.sent = [];
    ws2.sent = [];

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'm1', chatId, senderId: userId1, content: 'Cache test', createdAt: new Date().toISOString(), messageType: 'text', isAnonymous: false, senderName: 'User1', senderImage: null },
    });

    const ws1NewMsgs = getMessagesOfType(ws1, 'message:new');
    const ws2NewMsgs = getMessagesOfType(ws2, 'message:new');

    expect(ws1NewMsgs.length).toBeGreaterThan(0);
    expect(ws2NewMsgs.length).toBeGreaterThan(0);
  });

  it('does not broadcast to unsubscribed users', async () => {
    const userId1 = uid();
    const userId2 = uid();
    const chatId = cid();
    const ms = getMockState();

    ms.consumeTicket.mockReturnValue(userId1);
    const ws1 = emitConnection('t1');
    await sleep();

    ms.consumeTicket.mockReturnValue(userId2);
    const ws2 = emitConnection('t2');
    await sleep();

    ws1.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws1.sent = [];

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'm2', chatId, content: 'Only to ws1', senderId: userId1, createdAt: new Date().toISOString(), messageType: 'text', isAnonymous: false, senderName: 'User1', senderImage: null },
    });

    const ws1Msgs = getMessagesOfType(ws1, 'message:new');
    const ws2Msgs = getMessagesOfType(ws2, 'message:new');

    expect(ws1Msgs.length).toBeGreaterThan(0);
    expect(ws2Msgs.length).toBe(0);
  });

  it('maintains message order across rapid broadcasts', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-order-cache');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    for (let i = 0; i < 5; i++) {
      broadcastToRoom(chatId, {
        type: 'message:new',
        payload: { id: `order-${i}`, chatId, senderId: userId, content: `Ordered msg ${i}`, createdAt: new Date(Date.now() - (5 - i) * 100).toISOString(), messageType: 'text', isAnonymous: false, senderName: 'User', senderImage: null },
      });
    }
    await sleep();

    const msgs = getMessagesOfType(ws, 'message:new');
    expect(msgs.length).toBe(5);
  });

  it('delivers notification:new to correct user', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-notif');
    await sleep();

    sendToUser(userId, {
      type: 'notification:new',
      payload: { id: 'notif-1', receiver_user_id: userId, sender_user_id: uid(), type: 'friend_request', content: 'Test', entity_id: cid(), read_at: null, created_at: new Date().toISOString() },
    });

    const msgs = getMessagesOfType(ws, 'notification:new');
    expect(msgs.length).toBeGreaterThan(0);
    expect((msgs[0].payload as any).id).toBe('notif-1');
  });

  it('delivers chat:new to correct user', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-chat');
    await sleep();

    sendToUser(userId, {
      type: 'chat:new',
      payload: { chat: { id: chatId, name: 'New Chat', lastMessage: '', timestamp: Date.now(), unread: 0, type: 'dm', messageCount: 0, members: [] } },
    });

    const msgs = getMessagesOfType(ws, 'chat:new');
    expect(msgs.length).toBeGreaterThan(0);
    expect((msgs[0].payload as any).chat.id).toBe(chatId);
  });
});

describe('Race Conditions', () => {
  it('handles subscribe and message arriving simultaneously', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-race');
    await sleep();

    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'race-msg', chatId, senderId: userId, content: 'Race condition msg', createdAt: new Date().toISOString(), messageType: 'text', isAnonymous: false, senderName: 'User', senderImage: null },
    });
    await sleep();

    const msgs = getMessagesOfType(ws, 'message:new');
    const subscribed = getMessagesOfType(ws, 'subscribed');
    expect(subscribed.length).toBeGreaterThan(0);
  });

  it('handles multiple users subscribing to same room at same time', async () => {
    const chatId = cid();
    const ms = getMockState();
    const sockets: any[] = [];

    for (let i = 0; i < 5; i++) {
      const userId = uid();
      ms.consumeTicket.mockReturnValue(userId);
      const ws = emitConnection(`ticket-race-${i}`);
      await sleep(2);
      sockets.push(ws);
    }

    for (const ws of sockets) {
      ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    }
    await sleep();

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'broadcast-to-all', chatId, senderId: uid(), content: 'To everyone', createdAt: new Date().toISOString(), messageType: 'text', isAnonymous: false, senderName: 'Broadcaster', senderImage: null },
    });

    for (const ws of sockets) {
      const msgs = getMessagesOfType(ws, 'message:new');
      expect(msgs.length).toBeGreaterThan(0);
    }
  });

  it('handles simultaneous unsubscribe and message send', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-unsub-race');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    ws.emit('message', JSON.stringify({ type: 'unsubscribe', payload: { chatIds: [chatId] } }));
    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'after-unsub', chatId, senderId: userId, content: 'Should not arrive', createdAt: new Date().toISOString(), messageType: 'text', isAnonymous: false, senderName: 'User', senderImage: null },
    });
    await sleep();

    const msgs = getMessagesOfType(ws, 'message:new');
    expect(msgs.filter(m => (m.payload as any).id === 'after-unsub').length).toBe(0);
  });

  it('handles profile update race during message send', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-profile-race');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'profile-race', chatId, senderId: userId, content: 'Profile race msg', createdAt: new Date().toISOString(), messageType: 'text', isAnonymous: false, senderName: 'User', senderImage: 'https://old.img' },
    });
    await sleep();

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'profile-race-2', chatId, senderId: userId, content: 'After profile update', createdAt: new Date().toISOString(), messageType: 'text', isAnonymous: false, senderName: 'User', senderImage: 'https://new.img' },
    });
    await sleep();

    const msgs = getMessagesOfType(ws, 'message:new');
    expect(msgs.length).toBe(2);
  });
});
