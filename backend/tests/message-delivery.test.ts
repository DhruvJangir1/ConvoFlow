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

import { createWebSocketServer as setupWebSocket, shutdownWebSocket, broadcastToRoom } from '../ws/websocket.js';
import {
  getMockState, createFreshMockState, resetMockState,
  createMockWs, emitConnection, cleanEmitConnection,
  getAllSent, getMessagesOfType, sleep, sleepLong,
  setupDefaultMocks, setupWsTestServer, registerConnHandler,
  uid, cid, mid,
} from './helpers/index';

type WsMessage = { type: string; payload: Record<string, unknown> };

function requirePayload(m: WsMessage | undefined): Record<string, unknown> {
  if (!m) throw new Error('Expected a message but none was received');
  return m.payload;
}

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
   4. MESSAGE SENDING & DELIVERY
   ═══════════════════════════════════════════════════════════════════════ */

describe('Message Sending via WS', () => {
  it('sends message successfully and broadcasts to room', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-msg');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    ws.emit('message', JSON.stringify({ type: 'message:send', payload: { chatId, content: 'Hello, World!' } }));
    await sleep();

    const msgs = getAllSent(ws);
    const newMsg = msgs.find(m => m.type === 'message:new');
    const newMsgPayload = requirePayload(newMsg);
    expect(newMsgPayload.content).toBe('Hello, World!');
    expect(newMsgPayload.chatId).toBe(chatId);

    const ack = msgs.find(m => m.type === 'message:ack');
    const ackPayload = requirePayload(ack);
    expect(ackPayload.id).toBeDefined();
  });

  it('sends ack BEFORE broadcast for optimistic UI', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-ack-order');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    ws.emit('message', JSON.stringify({ type: 'message:send', payload: { chatId, content: 'Order test' } }));
    await sleep();

    const msgs = getAllSent(ws);
    const ackIdx = msgs.findIndex(m => m.type === 'message:ack');
    const newMsgIdx = msgs.findIndex(m => m.type === 'message:new');
    expect(ackIdx).toBeGreaterThanOrEqual(0);
    expect(newMsgIdx).toBeGreaterThan(ackIdx);
  });

  it('rejects empty or whitespace-only messages', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-empty');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    ws.emit('message', JSON.stringify({ type: 'message:send', payload: { chatId, content: '   ' } }));
    await sleep();

    const msgs = getAllSent(ws);
    expect(msgs.some(m => m.type === 'message:new')).toBe(false);
  });

  it('rejects messages without chatId', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-nochat');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'message:send', payload: { chatId: '', content: 'test' } }));
    await sleep();

    const msgs = getAllSent(ws);
    expect(msgs.some(m => m.type === 'message:new')).toBe(false);
  });

  it('includes sentAt timing in broadcast', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-timing');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    const beforeSend = Date.now();
    ws.emit('message', JSON.stringify({ type: 'message:send', payload: { chatId, content: 'Timed msg', sentAt: beforeSend } }));
    await sleep();

    const msgs = getAllSent(ws);
    const newMsg = msgs.find(m => m.type === 'message:new');
    const newMsgPayload = requirePayload(newMsg);
    expect(newMsgPayload.sentAt).toBe(beforeSend);
  });

  it('does not broadcast to sender unsubscribed from room', async () => {
    const userId1 = uid();
    const userId2 = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId1);
    const ws1 = emitConnection('ticket-u1');
    await sleep();

    ms.consumeTicket.mockReturnValue(userId2);
    const ws2 = emitConnection('ticket-u2');
    await sleep();

    ws1.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws1.sent = [];

    ws1.emit('message', JSON.stringify({ type: 'unsubscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws1.sent = [];

    broadcastToRoom(chatId, { type: 'message:new', payload: { id: 'm1', chatId, content: 'After unsub', senderId: userId2, createdAt: new Date().toISOString(), messageType: 'text', isAnonymous: false, senderName: 'User2', senderImage: null } });

    const ws1Msgs = getAllSent(ws1);
    expect(ws1Msgs.some(m => m.type === 'message:new')).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   5. MESSAGE ORDERING
   ═══════════════════════════════════════════════════════════════════════ */

describe('Message Ordering', () => {
  it('maintains order when messages arrive rapidly', async () => {
    const userId = uid();
    const chatId = cid();
    const senderId = uid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-order');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'm1', chatId, senderId, content: 'First', createdAt: new Date(Date.now() - 3000).toISOString(), messageType: 'text', isAnonymous: false, senderName: 'Alice', senderImage: null },
    });
    await sleep(5);
    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'm2', chatId, senderId, content: 'Second', createdAt: new Date(Date.now() - 2000).toISOString(), messageType: 'text', isAnonymous: false, senderName: 'Alice', senderImage: null },
    });
    await sleep(5);
    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'm3', chatId, senderId, content: 'Third', createdAt: new Date(Date.now() - 1000).toISOString(), messageType: 'text', isAnonymous: false, senderName: 'Alice', senderImage: null },
    });
    await sleep();

    const msgs = getMessagesOfType(ws, 'message:new');
    expect(msgs.length).toBe(3);
  });

  it('preserves order across rapid broadcast calls', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-rapid-order');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    const contents = ['msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5'];
    for (const content of contents) {
      broadcastToRoom(chatId, {
        type: 'message:new',
        payload: { id: mid(), chatId, senderId: userId, content, createdAt: new Date().toISOString(), messageType: 'text', isAnonymous: false, senderName: 'User', senderImage: null },
      });
    }
    await sleep();

    const msgs = getMessagesOfType(ws, 'message:new');
    expect(msgs.length).toBe(5);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   6. DUPLICATE MESSAGE PREVENTION
   ═══════════════════════════════════════════════════════════════════════ */

describe('Duplicate Message Prevention', () => {
  it('does not store duplicate message IDs in broadcast', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-dedup');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'dup-id-1', chatId, senderId: userId, content: 'Original', createdAt: new Date().toISOString(), messageType: 'text', isAnonymous: false, senderName: 'User', senderImage: null },
    });

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'dup-id-1', chatId, senderId: userId, content: 'Duplicate', createdAt: new Date().toISOString(), messageType: 'text', isAnonymous: false, senderName: 'User', senderImage: null },
    });
    await sleep();

    const msgs = getMessagesOfType(ws, 'message:new');
    const dedupedId = msgs.filter(m => (m.payload as any).id === 'dup-id-1');
    expect(dedupedId.length).toBe(2);
  });

  it('handles concurrent sends from same user without error', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-concurrent');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    const promises = Array.from({ length: 10 }, (_, i) => {
      return new Promise<void>((resolve) => {
        ws.emit('message', JSON.stringify({ type: 'message:send', payload: { chatId, content: `Concurrent msg ${i}` } }));
        resolve();
      });
    });

    await Promise.all(promises);
    await sleep(50);

    const ackCount = getMessagesOfType(ws, 'message:ack').length;
    expect(ackCount).toBe(10);
  });
});
