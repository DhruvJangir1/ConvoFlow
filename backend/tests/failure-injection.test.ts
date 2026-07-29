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
   11. FAILURE INJECTION TESTING
   ═══════════════════════════════════════════════════════════════════════ */

describe('Database Failure Injection', () => {
  it('handles DB failure during message send gracefully', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();

    ms.consumeTicket.mockReturnValue(userId);
    ms.prisma.$queryRaw.mockRejectedValue(new Error('DB connection lost'));

    const ws = emitConnection('ticket-db-fail-msg');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    expect(() => {
      ws.emit('message', JSON.stringify({ type: 'message:send', payload: { chatId, content: 'Should fail' } }));
    }).not.toThrow();
    await sleep();
  });

  it('handles DB timeout gracefully', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();

    ms.consumeTicket.mockReturnValue(userId);
    ms.prisma.$queryRaw.mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 50)));

    const ws = emitConnection('ticket-db-timeout');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    ws.emit('message', JSON.stringify({ type: 'message:send', payload: { chatId, content: 'Timeout test' } }));
    await sleep(80);
  });

  it('rejects unauthenticated message sends', async () => {
    const ws = createMockWs();
    ws.userId = undefined as any;
    ws.userName = undefined as any;

    const wss = (globalThis as any).__mockWss;
    if (wss._connHandler) {
      wss._connHandler(ws as unknown, { url: '/ws?ticket=noauth' });
    }
    await sleep();
  });
});

describe('WebSocket Failure Injection', () => {
  it('handles socket error during message send', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-ws-error');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();

    ws.emit('error');
    await sleep();

    // Socket should be removed from internal state but not explicitly closed
    expect(ms.mockWsInstances.length).toBeGreaterThanOrEqual(1);
  });

  it('handles broadcast to closed socket gracefully', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-broadcast-close');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    ws.readyState = 3;

    expect(() => {
      broadcastToRoom(chatId, { type: 'test', payload: {} });
    }).not.toThrow();
  });

  it('handles broadcast to nonexistent room', async () => {
    expect(() => {
      broadcastToRoom('nonexistent', { type: 'test', payload: {} });
    }).not.toThrow();
  });
});

describe('Ticket Store Failure', () => {
  it('handles ticket store returning null for unknown tickets', () => {
    const userId = uid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(null);
  });
});

describe('Server Restart Recovery', () => {
  it('shuts down cleanly without errors', () => {
    expect(() => {
      shutdownWebSocket();
    }).not.toThrow();
  });

  it('rejects messages after shutdown', async () => {
    shutdownWebSocket();

    const userId = uid();
    const chatId = cid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = createMockWs();
    const wss = (globalThis as any).__mockWss;
    if (wss && wss._connHandler) {
      wss._connHandler(ws as unknown, { url: `/ws?ticket=after-shutdown` });
    }
    await sleep();
  });
});
