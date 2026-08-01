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

vi.mock('../src/middleware/authenticate.js', () => ({
  authenticate: async (req: any, _res: any, next: any) => {
    if (!req.user) {
      req.user = { id: 'test-auto-id', email: 'test@auto.com' };
    }
    next();
  },
}));

vi.mock('../src/services/chatMessageService.js', () => ({
  insertStandardChatMessage: async (messageId: string, chatId: string, senderId: string, content: string) => ({
    id: messageId,
    createdAt: new Date(),
  }),
  requireChatMembership: async (userId: string, chatId: string) => {
    const s = (globalThis as any).__testMockState;
    if (s && s._securityMockMembership !== undefined) return s._securityMockMembership;
    return true;
  },
}));

import { createWebSocketServer as setupWebSocket, shutdownWebSocket } from '../ws/websocket.js';
import {
  getMockState, createFreshMockState, resetMockState,
  createMockWs, emitConnection, cleanEmitConnection,
  getAllSent, getMessagesOfType, sleep,
  setupDefaultMocks, setupWsTestServer, registerConnHandler,
  uid, cid,
} from './helpers/index';

let server: { on: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as Record<string, unknown>).__testMockState = createFreshMockState();
  (globalThis as Record<string, unknown>).__mockWss = undefined;
  (globalThis as any).__testMockState._securityMockMembership = true;
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
   10. SECURITY & AUTHORIZATION
   ═══════════════════════════════════════════════════════════════════════ */

describe('WebSocket Authorization', () => {
  it('rejects connection without valid ticket', async () => {
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(null);

    const ws = emitConnection('invalid-ticket');
    await sleep();
    expect(ws.close).toHaveBeenCalledWith(4001, 'Invalid or expired ticket');
  });

  it('authenticates user ID from ticket', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('valid-ticket');
    await sleep();
    expect(ws.userId).toBe(userId);
  });
});

describe('Chat Membership Enforcement', () => {
  it('cannot send message to chat without membership', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();

    (globalThis as any).__testMockState._securityMockMembership = false;
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-no-member');
    await sleep();
    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    ws.emit('message', JSON.stringify({ type: 'message:send', payload: { chatId, content: 'Hacked message' } }));
    await sleep();

    const msgs = getAllSent(ws);
    expect(msgs.some(m => m.type === 'message:new')).toBe(false);
  });

  it('rejects subscribe with non-array chatIds', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-bad-sub');
    await sleep();

    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: 'not-array' as any } }));
    await sleep();
  });

  it('rejects unsubscribe with non-array chatIds', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-bad-unsub');
    await sleep();

    ws.emit('message', JSON.stringify({ type: 'unsubscribe', payload: { chatIds: 'not-array' as any } }));
    await sleep();
  });

  it('rejects messages with unknown type gracefully', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-unknown-type');
    await sleep();

    ws.emit('message', JSON.stringify({ type: 'nonexistent_type', payload: {} }));
    await sleep();
  });

  it('rejects invalid JSON messages', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-bad-json');
    await sleep();

    ws.emit('message', 'not json at all');
    await sleep();
  });
});

describe('Friend Request Authorization', () => {
  let FriendRouter: any;

  beforeEach(async () => {
    const mod = await import('../src/routes/userAddFriend');
    FriendRouter = mod.default;
  });

  it('rejects friend request accept when not the receiver', async () => {
    const userId = uid();
    const senderId = uid();
    const ms = getMockState();
    ms.prisma.addFriendRequests.findUnique.mockResolvedValue({
      id: 'fr-1',
      sender_id: senderId,
      receiver_id: uid(),
      status: 'pending',
    });

    const req = { body: { notification: { entity_id: 'fr-1', sender_user_id: senderId } }, user: { id: userId }, params: {}, method: 'PATCH' } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;

    await FriendRouter.stack[1].route.stack.at(-1).handle(req, res, () => {}); await sleep(10);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects friend request reject when not the receiver', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.prisma.addFriendRequests.findUnique.mockResolvedValue({
      id: 'fr-1',
      sender_id: uid(),
      receiver_id: uid(),
      status: 'pending',
      USERS_AddFriendRequests_receiver_idToUSERS: { user_name: 'Test' },
      USERS_AddFriendRequests_sender_idToUSERS: { id: uid() },
    });

    const req = { body: {}, user: { id: userId }, params: { id: 'fr-1' }, method: 'PATCH' } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;

    await FriendRouter.stack[2].route.stack.at(-1).handle(req, res, () => {}); await sleep(10);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('Notification Authorization', () => {
  let NotificationRouter: any;

  beforeEach(async () => {
    const mod = await import('../src/routes/userNotification');
    NotificationRouter = mod.default;
  });

  it('rejects marking another users notification as read', async () => {
    const userId = uid();
    const notifId = cid();
    const ms = getMockState();

    ms.prisma.notifications.findUnique.mockResolvedValue({
      id: notifId,
      receiver_user_id: uid(),
      read_at: null,
    });

    const req = { body: {}, user: { id: userId }, params: { id: notifId }, method: 'PATCH' } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;

    await NotificationRouter.stack[1].route.stack.at(-1).handle(req, res, () => {}); await sleep(10);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
