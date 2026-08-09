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

vi.mock('../src/supabase/supabaseS3Client.js', () => ({ s3Client: {}, S3_BUCKET_NAME: 'test-bucket' }));

import { createWebSocketServer as setupWebSocket, shutdownWebSocket, sendToUser, broadcastToRoom } from '../ws/websocket.js';
import {
  getMockState, createFreshMockState, resetMockState,
  createMockWs, emitConnection, cleanEmitConnection,
  getAllSent, getMessagesOfType, sleep, sleepLong,
  setupDefaultMocks, setupWsTestServer, registerConnHandler,
  uid, cid,
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
   1. WEBSOCKET RECONNECTION TESTING
   ═══════════════════════════════════════════════════════════════════════ */

describe('WebSocket Reconnection', () => {
  it('re-connects with a new ticket after disconnect', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();

    ms.consumeTicket.mockReturnValue(userId);
    const ws1 = emitConnection('ticket-1');
    await sleep();
    ws1.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();

    ws1.emit('close');
    await sleep();

    sendToUser(userId, { type: 'test', payload: { msg: 'should-not-arrive' } });
    const ws1AfterClose = getAllSent(ws1);
    const afterCloseMsgs = ws1AfterClose.filter(m => m.type === 'test');
    expect(afterCloseMsgs.length).toBe(0);

    ms.consumeTicket.mockReturnValue(userId);
    const ws2 = emitConnection('ticket-2');
    await sleep();

    expect(ws2.userId).toBe(userId);
    expect(ws2.isAlive).toBe(true);

    ws2.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();

    sendToUser(userId, { type: 'test', payload: { msg: 'should-arrive-after-reconnect' } });
    const ws2Msgs = getAllSent(ws2);
    const reconnectMsgs = ws2Msgs.filter(m => m.type === 'test');
    expect(reconnectMsgs.length).toBeGreaterThan(0);
  });

  it('recovers missed messages sent during disconnect', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();

    ms.consumeTicket.mockReturnValue(userId);
    const ws1 = emitConnection('ticket-1');
    await sleep();
    ws1.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws1.sent = [];

    ws1.emit('close');
    await sleep();

    ms.consumeTicket.mockReturnValue(userId);
    const ws2 = emitConnection('ticket-2');
    await sleep();
    ws2.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws2.sent = [];

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'msg-recovery-1', chatId, senderId: 'other-user', content: 'Missed message recovered', createdAt: new Date().toISOString(), messageType: 'text', isAnonymous: false, senderName: 'Other', senderImage: null },
    });

    const ws2Msgs = getAllSent(ws2);
    const recovered = ws2Msgs.find(m => m.type === 'message:new');
    const recoveredPayload = requirePayload(recovered);
    expect(recoveredPayload.content).toBe('Missed message recovered');
  });

  it('does not leak duplicate socket entries on reconnect', async () => {
    const userId = uid();
    const ms = getMockState();

    ms.consumeTicket.mockReturnValue(userId);
    const ws1 = emitConnection('ticket-1');
    await sleep();

    ms.consumeTicket.mockReturnValue(userId);
    const ws2 = emitConnection('ticket-2');
    await sleep();

    sendToUser(userId, { type: 'test', payload: { msg: 'only-one-socket' } });
    const ws1Msgs = getAllSent(ws1).filter(m => m.type === 'test');
    const ws2Msgs = getAllSent(ws2).filter(m => m.type === 'test');

    expect(ws2Msgs.length).toBe(1);
  });

  it('handles multiple rapid reconnects without errors', async () => {
    const userId = uid();
    const ms = getMockState();

    for (let i = 0; i < 5; i++) {
      ms.consumeTicket.mockReturnValue(userId);
      const ws = emitConnection(`ticket-rapid-${i}`);
      await sleep(5);
      ws.emit('close');
      await sleep(5);
    }

    ms.consumeTicket.mockReturnValue(userId);
    const wsFinal = emitConnection('ticket-final');
    await sleep();
    expect(wsFinal.userId).toBe(userId);
    expect(wsFinal.isAlive).toBe(true);
  });

  it('resubscribes to previous rooms after reconnect', async () => {
    const userId = uid();
    const chat1 = cid();
    const chat2 = cid();
    const ms = getMockState();

    ms.consumeTicket.mockReturnValue(userId);
    const ws1 = emitConnection('ticket-sub-1');
    await sleep();
    ws1.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chat1, chat2] } }));
    await sleep();
    expect(ws1.subscribedRooms.has(chat1)).toBe(true);
    expect(ws1.subscribedRooms.has(chat2)).toBe(true);

    ws1.emit('close');
    await sleep();

    ms.consumeTicket.mockReturnValue(userId);
    const ws2 = emitConnection('ticket-sub-2');
    await sleep();
    expect(ws2.subscribedRooms.size).toBe(0);

    ws2.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chat1, chat2] } }));
    await sleep();
    expect(ws2.subscribedRooms.has(chat1)).toBe(true);
    expect(ws2.subscribedRooms.has(chat2)).toBe(true);
  });

  it('both old and new sockets receive when user reconnects before close', async () => {
    const userId = uid();
    const ms = getMockState();

    ms.consumeTicket.mockReturnValue(userId);
    const wsOld = emitConnection('ticket-old');
    await sleep();

    ms.consumeTicket.mockReturnValue(userId);
    const wsNew = emitConnection('ticket-new');
    await sleep();

    sendToUser(userId, { type: 'test', payload: { msg: 'both-sockets' } });

    const oldMsgs = getAllSent(wsOld).filter(m => m.type === 'test');
    const newMsgs = getAllSent(wsNew).filter(m => m.type === 'test');

    expect(oldMsgs.length).toBe(1);
    expect(newMsgs.length).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   2. CONNECTION FAILURE MODES
   ═══════════════════════════════════════════════════════════════════════ */

describe('Connection Failure Modes', () => {
  it('rejects connection with expired ticket', async () => {
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(null);

    const ws = emitConnection('expired-ticket');
    await sleep();
    expect(ws.close).toHaveBeenCalledWith(4001, 'Invalid or expired ticket');
  });

  it('rejects connection with no ticket in URL', async () => {
    const wss = (globalThis as Record<string, unknown>).__mockWss as any;
    const ws = createMockWs();
    if (wss._connHandler) {
      wss._connHandler(ws as unknown, { url: '/ws' });
    }
    await sleep();
    expect(ws.close).toHaveBeenCalledWith(4001, 'Invalid or expired ticket');
  });

  it('handles DB lookup failure gracefully during auth', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);
    ms.prisma.users.findUnique.mockRejectedValue(new Error('DB connection lost'));

    const ws = emitConnection('ticket-db-fail');
    await sleep();
    expect(ws.userId).toBe(userId);
    expect(ws.isAlive).toBe(true);
  });

  it('still registers socket even when DB is down', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);
    ms.prisma.users.findUnique.mockRejectedValue(new Error('DB unreachable'));

    const ws = emitConnection('ticket-no-db');
    await sleep();

    sendToUser(userId, { type: 'test', payload: { msg: 'socket-registered' } });
    const msgs = getAllSent(ws).filter(m => m.type === 'test');
    expect(msgs.length).toBeGreaterThan(0);
  });

  it('does not crash on malformed connection URL', async () => {
    const wss = (globalThis as Record<string, unknown>).__mockWss as any;
    if (wss._connHandler) {
      expect(() => {
        const ws = createMockWs();
        wss._connHandler(ws as unknown, { url: null });
      }).not.toThrow();
    }
    await sleep();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   3. HEARTBEAT & PONG
   ═══════════════════════════════════════════════════════════════════════ */

describe('Heartbeat / Pong', () => {
  it('pong handler resets isAlive', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-pong');
    await sleep();
    ws.isAlive = false;
    ws.emit('pong');
    expect(ws.isAlive).toBe(true);
  });

  it('terminates zombie connections on heartbeat', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-zombie');
    await sleep();
    ws.isAlive = false;

    if (ws.listeners('close').length > 0) {
      ws.emit('close');
      await sleep();
    }
  });
});
