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
   14. MULTI-DEVICE TESTING
   ═══════════════════════════════════════════════════════════════════════ */

describe('Multi-Device Scenario - Same User', () => {
  it('both devices receive messages in a room', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();

    ms.consumeTicket.mockReturnValue(userId);
    const deviceA = emitConnection('ticket-device-a');
    await sleep();

    ms.consumeTicket.mockReturnValue(userId);
    const deviceB = emitConnection('ticket-device-b');
    await sleep();

    deviceA.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    deviceB.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    deviceA.sent = [];
    deviceB.sent = [];

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'multi-device-msg', chatId, senderId: uid(), content: 'Hi both devices!', createdAt: new Date().toISOString(), messageType: 'text', isAnonymous: false, senderName: 'Alice', senderImage: null },
    });

    const aMsgs = getMessagesOfType(deviceA, 'message:new');
    const bMsgs = getMessagesOfType(deviceB, 'message:new');

    expect(aMsgs.length).toBeGreaterThan(0);
    expect(bMsgs.length).toBeGreaterThan(0);
  });

  it('both devices receive notification:new', async () => {
    const userId = uid();
    const ms = getMockState();

    ms.consumeTicket.mockReturnValue(userId);
    const deviceA = emitConnection('ticket-notif-a');
    await sleep();

    ms.consumeTicket.mockReturnValue(userId);
    const deviceB = emitConnection('ticket-notif-b');
    await sleep();

    deviceA.sent = [];
    deviceB.sent = [];

    sendToUser(userId, {
      type: 'notification:new',
      payload: { id: 'notif-multi', receiver_user_id: userId, sender_user_id: uid(), type: 'friend_request', content: 'Multi-device notif', entity_id: cid(), read_at: null, created_at: new Date().toISOString() },
    });

    const aNotifs = getMessagesOfType(deviceA, 'notification:new');
    const bNotifs = getMessagesOfType(deviceB, 'notification:new');

    expect(aNotifs.length).toBe(1);
    expect(bNotifs.length).toBe(1);
  });

  it('sending from one device broadcasts to all devices in room', async () => {
    const senderId = uid();
    const otherUserId = uid();
    const chatId = cid();
    const ms = getMockState();

    ms.consumeTicket.mockReturnValue(senderId);
    const senderDeviceA = emitConnection('ticket-send-a');
    await sleep();

    ms.consumeTicket.mockReturnValue(senderId);
    const senderDeviceB = emitConnection('ticket-send-b');
    await sleep();

    ms.consumeTicket.mockReturnValue(otherUserId);
    const receiverDevice = emitConnection('ticket-recv');
    await sleep();

    senderDeviceA.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    senderDeviceB.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    receiverDevice.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();

    senderDeviceA.sent = [];
    senderDeviceB.sent = [];
    receiverDevice.sent = [];

    senderDeviceA.emit('message', JSON.stringify({ type: 'message:send', payload: { chatId, content: 'Multi-device send' } }));
    await sleep();

    const senderBMsgs = getMessagesOfType(senderDeviceB, 'message:new');
    const receiverMsgs = getMessagesOfType(receiverDevice, 'message:new');

    expect(senderBMsgs.length).toBeGreaterThan(0);
    expect(receiverMsgs.length).toBeGreaterThan(0);
  });

  it('logout on one device does not affect the other', async () => {
    const userId = uid();
    const chatId = cid();
    const ms = getMockState();

    ms.consumeTicket.mockReturnValue(userId);
    const deviceA = emitConnection('ticket-logout-a');
    await sleep();

    ms.consumeTicket.mockReturnValue(userId);
    const deviceB = emitConnection('ticket-logout-b');
    await sleep();

    deviceA.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    deviceB.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    deviceA.sent = [];
    deviceB.sent = [];

    deviceA.emit('close');
    await sleep();

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: { id: 'after-device-a-logout', chatId, senderId: uid(), content: 'Device B should receive', createdAt: new Date().toISOString(), messageType: 'text', isAnonymous: false, senderName: 'Alice', senderImage: null },
    });

    const bMsgs = getMessagesOfType(deviceB, 'message:new');
    expect(bMsgs.length).toBeGreaterThan(0);
  });
});

describe('Multi-Device Online Status', () => {
  it('broadcasts user:online when each device subscribes', async () => {
    const chatId = cid();
    const ms = getMockState();

    ms.consumeTicket.mockReturnValue(uid());
    const otherUser = emitConnection('ticket-other');
    await sleep();
    otherUser.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    otherUser.sent = [];

    const userId = uid();
    ms.consumeTicket.mockReturnValue(userId);
    const deviceA = emitConnection('ticket-device-online-a');
    await sleep();

    deviceA.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();

    const otherMsgs = getMessagesOfType(otherUser, 'user:online');
    const deviceAOnline = otherMsgs.filter(m => (m.payload as any).userId === userId);
    expect(deviceAOnline.length).toBeGreaterThan(0);
  });
});
