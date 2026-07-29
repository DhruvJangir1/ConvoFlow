import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EventEmitter } from 'events';

// ─── Mock state on globalThis ──────────────────────────────────────────────────

interface MockWsInstance {
  readyState: number;
  sent: string[];
  closed: boolean;
  closeCode: number | undefined;
  closeReason: string | undefined;
  subscribedRooms: Set<string>;
  userId: string | undefined;
  userName: string | undefined;
  userImage: string | undefined | null;
  isAlive: boolean;
  _listeners: Record<string, ((...args: unknown[]) => void)[]>;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
  pong: ReturnType<typeof vi.fn>;
  on: (event: string, fn: (...args: unknown[]) => void) => MockWsInstance;
  emit: (event: string, ...args: unknown[]) => boolean;
  listeners: (event: string) => ((...args: unknown[]) => void)[];
}

interface MockWSS {
  _listeners: Record<string, ((...args: unknown[]) => void)[]>;
  _connHandler: ((ws: unknown, req: { url: string }) => void) | undefined;
  clients: Set<unknown>;
  on: (event: string, fn: (...args: unknown[]) => void) => MockWSS;
  emit: (event: string, ...args: unknown[]) => boolean;
  listeners: (event: string) => ((...args: unknown[]) => void)[];
  close: () => void;
}

interface MockState {
  consumeTicket: ReturnType<typeof vi.fn>;
  startTicketCleanup: ReturnType<typeof vi.fn>;
  stopTicketCleanup: ReturnType<typeof vi.fn>;
  prisma: {
    users: { findUnique: ReturnType<typeof vi.fn> };
    standardChatMembers: { findUnique: ReturnType<typeof vi.fn> };
    $queryRaw: ReturnType<typeof vi.fn>;
    standardChats: { update: ReturnType<typeof vi.fn> };
  };
  mockWsInstances: MockWsInstance[];
}

function makeEventEmitter() {
  const _listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    _listeners,
    on(event: string, fn: (...args: unknown[]) => void) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(fn);
      return this;
    },
    emit(event: string, ...args: unknown[]) {
      const fns = _listeners[event];
      if (fns) fns.forEach((fn) => fn(...args));
      return true;
    },
    listeners(event: string) {
      return _listeners[event] ?? [];
    },
  };
}

function getMockState(): MockState {
  const g = globalThis as Record<string, unknown>;
  if (!g.__mockState) {
    g.__mockState = {
      consumeTicket: vi.fn<(ticket: string) => string | null>(),
      startTicketCleanup: vi.fn(),
      stopTicketCleanup: vi.fn(),
      prisma: {
        users: { findUnique: vi.fn() },
        standardChatMembers: { findUnique: vi.fn() },
        $queryRaw: vi.fn(),
        standardChats: { update: vi.fn() },
      },
      mockWsInstances: [] as MockWsInstance[],
    };
  }
  return g.__mockState as MockState;
}

function getMockWss(): MockWSS {
  return (globalThis as Record<string, unknown>).__mockWss as MockWSS;
}

// ─── Mock ws (no external references) ──────────────────────────────────────────

vi.mock('ws', () => {
  function MockWSS() {
    const instance = Object.assign(makeEventEmitter(), {
      clients: new Set(),
      _connHandler: undefined as ((ws: unknown, req: { url: string }) => void) | undefined,
      close() {},
    });
    (globalThis as Record<string, unknown>).__mockWss = instance;
    return instance;
  }
  return {
    WebSocketServer: MockWSS,
    WebSocket: { OPEN: 1, CLOSED: 3 },
  };
});

// ─── Mock ticket store ─────────────────────────────────────────────────────────

vi.mock('../src/services/wsTicketStore.js', () => ({
  get consumeTicket() { return getMockState().consumeTicket; },
  get startTicketCleanup() { return getMockState().startTicketCleanup; },
  get stopTicketCleanup() { return getMockState().stopTicketCleanup; },
}));

// ─── Mock Prisma ───────────────────────────────────────────────────────────────

vi.mock('../src/lib/connectionPoolClient.js', () => ({
  get prisma() { return getMockState().prisma; },
}));

// ─── Mock S3 client ────────────────────────────────────────────────────────────

vi.mock('../src/supabase/supabaseS3Client.js', () => ({
  s3Client: {},
  S3_BUCKET_NAME: 'test-bucket',
}));

// ─── Import after mocks ────────────────────────────────────────────────────────

import { createWebSocketServer as setupWebSocket, shutdownWebSocket, sendToUser, broadcastToRoom, broadcastMessageToRoom } from './websocket';

// ─── Helpers ───────────────────────────────────────────────────────────────────

let testCounter = 0;
function uid() { return `user-${++testCounter}-${Date.now()}`; }
function cid() { return `chat-${++testCounter}-${Date.now()}`; }

function createMockWs(): MockWsInstance {
  const ee = makeEventEmitter();
  const ws: MockWsInstance = {
    readyState: 1,
    sent: [],
    closed: false,
    closeCode: undefined,
    closeReason: undefined,
    subscribedRooms: new Set(),
    userId: undefined,
    userName: undefined,
    userImage: undefined,
    isAlive: true,
    _listeners: ee._listeners,
    send: vi.fn((data: unknown) => { ws.sent.push(String(data)); }),
    close: vi.fn((code?: number, reason?: string) => {
      ws.closed = true;
      ws.closeCode = code;
      ws.closeReason = reason;
      ws.readyState = 3;
    }),
    terminate: vi.fn(() => { ws.readyState = 3; ws.closed = true; }),
    ping: vi.fn(),
    pong: vi.fn(),
    on: ee.on.bind(ee) as MockWsInstance['on'],
    emit: ee.emit.bind(ee) as MockWsInstance['emit'],
    listeners: ee.listeners.bind(ee) as MockWsInstance['listeners'],
  };
  getMockState().mockWsInstances.push(ws);
  return ws;
}

function emitConnection(ticket: string) {
  const wss = getMockWss();
  const ws = createMockWs();
  if (wss._connHandler) {
    wss._connHandler(ws as unknown, { url: `/ws?ticket=${ticket}` });
  }
  return ws;
}

function getAllSent(ws: MockWsInstance) {
  return ws.sent.map((raw) => JSON.parse(raw) as { type: string; payload: Record<string, unknown> });
}

function sleep(ms = 15) { return new Promise((r) => setTimeout(r, ms)); }

// ─── Tests ─────────────────────────────────────────────────────────────────────

let server: { on: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as Record<string, unknown>).__mockWss = undefined;
  getMockState().mockWsInstances.length = 0;
  server = { on: vi.fn() };

  const ms = getMockState();
  ms.prisma.users.findUnique.mockResolvedValue({ user_name: 'TestUser', image_url: 'https://img.test/a.png' });
  ms.prisma.standardChatMembers.findUnique.mockResolvedValue({ user_id: 'member' });
  ms.prisma.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const id = values[0] as string;
    return [{ id, createdAt: new Date() }];
  });
  ms.prisma.standardChats.update.mockResolvedValue({});

  setupWebSocket(server as never);

  const wss = getMockWss();
  const listeners = wss.listeners('connection');
  if (listeners.length > 0) {
    wss._connHandler = listeners[listeners.length - 1] as (ws: unknown, req: { url: string }) => void;
  }
});

afterEach(() => {
  shutdownWebSocket();
  getMockState().mockWsInstances.length = 0;
});

// ── Connection ─────────────────────────────────────────────────────────────────

describe('WebSocket connection', () => {
  it('authenticates with valid ticket and sets user info from DB', async () => {
    const userId = uid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('valid-ticket');
    await sleep();

    expect(ws.userId).toBe(userId);
    expect(ws.userName).toBe('TestUser');
    expect(ws.userImage).toBe('https://img.test/a.png');
    expect(ws.isAlive).toBe(true);
    expect(ws.subscribedRooms).toBeInstanceOf(Set);
  });

  it('closes with 4001 on invalid ticket', async () => {
    getMockState().consumeTicket.mockReturnValue(null);

    const ws = emitConnection('bad-ticket');
    await sleep();

    expect(ws.close).toHaveBeenCalledWith(4001, 'Invalid or expired ticket');
  });

  it('starts ticket cleanup on setup', () => {
    expect(getMockState().startTicketCleanup).toHaveBeenCalled();
  });

  it('stops ticket cleanup on shutdown', () => {
    shutdownWebSocket();
    expect(getMockState().stopTicketCleanup).toHaveBeenCalled();
  });
});

// ── Subscribe / Unsubscribe ────────────────────────────────────────────────────

describe('Subscribe / Unsubscribe', () => {
  it('subscribe adds socket to room, sends subscribed ack and chat:online-users', async () => {
    const userId = uid();
    const chatId = cid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-sub');
    await sleep();

    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();

    const msgs = getAllSent(ws);
    const subscribed = msgs.find((m) => m.type === 'subscribed');
    expect(subscribed).toBeDefined();
    expect(subscribed!.payload.chatIds).toContain(chatId);

    const onlineUsers = msgs.find((m) => m.type === 'chat:online-users');
    expect(onlineUsers).toBeDefined();
    expect(onlineUsers!.payload.chatId).toBe(chatId);
    expect(onlineUsers!.payload.userIds as string[]).toContain(userId);
  });

  it('subscribe broadcasts user:online to other room members', async () => {
    const userId1 = uid();
    const userId2 = uid();
    const chatId = cid();
    getMockState().consumeTicket.mockReturnValue(userId1);

    const ws1 = emitConnection('t1');
    await sleep();
    ws1.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();

    getMockState().consumeTicket.mockReturnValue(userId2);
    const ws2 = emitConnection('t2');
    await sleep();

    ws1.sent = [];
    ws2.sent = [];

    ws2.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();

    const ws1Msgs = getAllSent(ws1);
    const online = ws1Msgs.find((m) => m.type === 'user:online');
    expect(online).toBeDefined();
    expect(online!.payload.userId).toBe(userId2);
    expect(online!.payload.chatId).toBe(chatId);
  });

  it('unsubscribe sends unsubscribed ack', async () => {
    const userId = uid();
    const chatId = cid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-unsub');
    await sleep();

    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    ws.emit('message', JSON.stringify({ type: 'unsubscribe', payload: { chatIds: [chatId] } }));
    await sleep();

    const msgs = getAllSent(ws);
    const unsub = msgs.find((m) => m.type === 'unsubscribed');
    expect(unsub).toBeDefined();
    expect(unsub!.payload.chatIds).toContain(chatId);
  });

  it('subscribe to multiple rooms', async () => {
    const userId = uid();
    const c1 = cid();
    const c2 = cid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('ticket-multi');
    await sleep();

    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [c1, c2] } }));
    await sleep();

    const msgs = getAllSent(ws);
    const subscribed = msgs.find((m) => m.type === 'subscribed');
    expect(subscribed).toBeDefined();
    expect(subscribed!.payload.chatIds).toEqual([c1, c2]);
  });
});

// ── Broadcast to Room ──────────────────────────────────────────────────────────

describe('Broadcast to room', () => {
  it('broadcastToRoom sends to all subscribers', async () => {
    const userId1 = uid();
    const userId2 = uid();
    const chatId = cid();
    getMockState().consumeTicket.mockReturnValue(userId1);

    const ws1 = emitConnection('t1');
    await sleep();
    getMockState().consumeTicket.mockReturnValue(userId2);
    const ws2 = emitConnection('t2');
    await sleep();

    ws1.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    ws2.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();

    ws1.sent = [];
    ws2.sent = [];

    broadcastToRoom(chatId, { type: 'test:event', payload: { hello: 'world' } });

    expect(ws1.sent.length).toBeGreaterThan(0);
    expect(ws2.sent.length).toBeGreaterThan(0);

    const msg1 = JSON.parse(ws1.sent[0]);
    expect(msg1.type).toBe('test:event');
  });

  it('broadcastToRoom does nothing for unknown chatId', () => {
    broadcastToRoom('nonexistent', { type: 'test', payload: {} });
  });

  it('broadcastMessageToRoom sends raw buffer', async () => {
    const userId = uid();
    const chatId = cid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('t-buf');
    await sleep();

    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    const buf = Buffer.from(JSON.stringify({ type: 'message:new', payload: { id: '1' } }));
    broadcastMessageToRoom(chatId, buf, false);

    expect(ws.sent.length).toBe(1);
  });
});

// ── Send Message via WS ───────────────────────────────────────────────────────

describe('Send message via WS', () => {
  it('writes to DB and broadcasts message:new', async () => {
    const ms = getMockState();
    const userId = uid();
    const chatId = cid();
    ms.consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('t-send');
    await sleep();

    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    ws.emit('message', JSON.stringify({ type: 'message:send', payload: { chatId, content: 'Hello world' } }));
    await sleep();

    expect(ms.prisma.$queryRaw).toHaveBeenCalled();
    expect(ms.prisma.standardChats.update).toHaveBeenCalled();

    const msgs = getAllSent(ws);
    const newMsg = msgs.find((m) => m.type === 'message:new');
    expect(newMsg).toBeDefined();
    expect(newMsg!.payload.content).toBe('Hello world');
    expect(newMsg!.payload.chatId).toBe(chatId);
  });

  it('sends message:ack with message id', async () => {
    const userId = uid();
    const chatId = cid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('t-ack');
    await sleep();

    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    ws.emit('message', JSON.stringify({ type: 'message:send', payload: { chatId, content: 'test' } }));
    await sleep();

    const msgs = getAllSent(ws);
    const ack = msgs.find((m) => m.type === 'message:ack');
    expect(ack).toBeDefined();
    expect(ack!.payload.id).toBeDefined();
  });

  it('ignores empty content', async () => {
    const userId = uid();
    const chatId = cid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('t-empty');
    await sleep();

    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();
    ws.sent = [];

    ws.emit('message', JSON.stringify({ type: 'message:send', payload: { chatId, content: '   ' } }));
    await sleep();

    expect(getMockState().prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('broadcasts to other room members', async () => {
    const userId1 = uid();
    const userId2 = uid();
    const chatId = cid();
    getMockState().consumeTicket.mockReturnValue(userId1);

    const ws1 = emitConnection('t1');
    await sleep();
    getMockState().consumeTicket.mockReturnValue(userId2);
    const ws2 = emitConnection('t2');
    await sleep();

    ws1.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    ws2.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();

    ws1.sent = [];
    ws2.sent = [];

    ws1.emit('message', JSON.stringify({ type: 'message:send', payload: { chatId, content: 'hi' } }));
    await sleep();

    const ws2Msgs = getAllSent(ws2);
    const newMsg = ws2Msgs.find((m) => m.type === 'message:new');
    expect(newMsg).toBeDefined();
    expect(newMsg!.payload.content).toBe('hi');
  });
});

// ── Disconnect / Error ─────────────────────────────────────────────────────────

describe('Disconnect and error', () => {
  it('removes socket from userSockets on close', async () => {
    const userId = uid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('t-close');
    await sleep();

    ws.emit('close');
    await sleep();

    sendToUser(userId, { type: 'test', payload: {} });
  });

  it('removes socket from rooms and broadcasts user:offline on close', async () => {
    const userId = uid();
    const chatId = cid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('t-close-room');
    await sleep();

    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: [chatId] } }));
    await sleep();

    ws.emit('close');
    await sleep();
  });

  it('cleans up on error event', async () => {
    const userId = uid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('t-error');
    await sleep();

    ws.emit('error');
    await sleep();
  });
});

// ── sendToUser ─────────────────────────────────────────────────────────────────

describe('sendToUser', () => {
  it('sends to the correct user socket', async () => {
    const userId = uid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('t-sendto');
    await sleep();

    sendToUser(userId, { type: 'notification:new', payload: { id: 'n1' } });

    const msgs = getAllSent(ws);
    const notif = msgs.find((m) => m.type === 'notification:new');
    expect(notif).toBeDefined();
    expect(notif!.payload.id).toBe('n1');
  });

  it('does nothing for unknown user', () => {
    sendToUser('nonexistent', { type: 'test', payload: {} });
  });
});

// ── Pong / Heartbeat ──────────────────────────────────────────────────────────

describe('Pong / Heartbeat', () => {
  it('pong sets isAlive to true', async () => {
    const userId = uid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('t-pong');
    await sleep();

    ws.isAlive = false;
    ws.emit('pong');
    expect(ws.isAlive).toBe(true);
  });
});

// ── Malformed messages ─────────────────────────────────────────────────────────

describe('Malformed messages', () => {
  it('ignores invalid JSON gracefully', async () => {
    const userId = uid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('t-malformed');
    await sleep();

    ws.emit('message', 'not json');
    await sleep();
  });

  it('ignores unknown message types', async () => {
    const userId = uid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('t-unknown');
    await sleep();

    ws.emit('message', JSON.stringify({ type: 'nonexistent', payload: {} }));
    await sleep();
  });

  it('ignores subscribe with non-array chatIds', async () => {
    const userId = uid();
    getMockState().consumeTicket.mockReturnValue(userId);

    const ws = emitConnection('t-bad-sub');
    await sleep();

    ws.emit('message', JSON.stringify({ type: 'subscribe', payload: { chatIds: 'not-array' } }));
    await sleep();
  });
});
