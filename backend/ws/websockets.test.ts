import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Hoisted mocks (vi.hoisted runs before all imports)
// =============================================================================

const {
  mockConsumeTicket,
  mockStartTicketCleanup,
  mockStopTicketCleanup,
  mockPrismaCreate,
  mockPrismaUpdate,
  mockPrismaFindUnique,
  createMockWs,
  createMockWss,
  getMockWss,
  getMockHttpServer,
} = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;

  class SimpleEmitter {
    private _listeners: Record<string, Listener[]> = {};

    on(event: string, fn: Listener) {
      (this._listeners[event] ??= []).push(fn);
      return this;
    }

    once(event: string, fn: Listener) {
      const wrapper: Listener = (...args) => {
        fn(...args);
        this.off(event, wrapper);
      };
      return this.on(event, wrapper);
    }

    off(event: string, fn: Listener) {
      const list = this._listeners[event];
      if (list) this._listeners[event] = list.filter((f) => f !== fn);
      return this;
    }

    emit(event: string, ...args: unknown[]) {
      this._listeners[event]?.forEach((fn) => fn(...args));
    }
  }

  class MockWsInstance extends SimpleEmitter {
    readyState = 1;
    url = '';
    userId?: string;
    userName?: string;
    userImage?: string | null;
    isAlive?: boolean;
    subscribedRooms?: Set<string>;
    sent: string[] = [];

    send(data: string) {
      this.sent.push(data);
    }

    close() {
      this.readyState = 3;
    }

    terminate() {
      this.readyState = 3;
    }

    ping() {}
  }

  const wssState = {
    clients: null as MockWsInstance[] | null,
    closeFn: null as (() => void) | null,
  };

  let lastMockWss: ReturnType<typeof createMockWss> | null = null;

  function getMockWss() {
    if (!lastMockWss) throw new Error('Mock WSS not initialized');
    return lastMockWss;
  }

  function createMockWss() {
    const listeners: Record<string, Listener[]> = {};
    const clients = new Set<MockWsInstance>();

    const wss = new SimpleEmitter();
    (wss as Record<string, unknown>).clients = clients;

    const origOn = wss.on.bind(wss);
    wss.on = (event: string, fn: Listener) => {
      (listeners[event] ??= []).push(fn);
      origOn(event, fn);
      return wss;
    };

    wssState.clients = [...clients] as unknown as MockWsInstance[];

    wss.emit = (event: string, ...args: unknown[]) => {
      listeners[event]?.forEach((fn) => fn(...args));
      return wss;
    };

    (wss as Record<string, unknown>).close = () => {
      listeners['close']?.forEach((fn) => fn());
    };

    wssState.closeFn = (wss as Record<string, unknown>).close as () => void;

    lastMockWss = { wss, clients, listeners };
    return lastMockWss;
  }

  const httpServerState = {
    listeners: {} as Record<string, Listener[]>,
  };

  const mockHttpServer = new SimpleEmitter();
  const origHttpOn = mockHttpServer.on.bind(mockHttpServer);
  mockHttpServer.on = (event: string, fn: Listener) => {
    (httpServerState.listeners[event] ??= []).push(fn);
    origHttpOn(event, fn);
    return mockHttpServer;
  };
  mockHttpServer.emit = (event: string, ...args: unknown[]) => {
    httpServerState.listeners[event]?.forEach((fn) => fn(...args));
    return mockHttpServer;
  };
  (mockHttpServer as Record<string, unknown>).listen = vi.fn();
  (mockHttpServer as Record<string, unknown>).close = vi.fn();

  return {
    mockConsumeTicket: vi.fn(),
    mockStartTicketCleanup: vi.fn(),
    mockStopTicketCleanup: vi.fn(),
    mockPrismaCreate: vi.fn(),
    mockPrismaUpdate: vi.fn(),
    mockPrismaFindUnique: vi.fn(),
    createMockWs: () => new MockWsInstance(),
    createMockWss,
    getMockWss,
    getMockHttpServer: () => mockHttpServer,
  };
});

// =============================================================================
// Module mocks
// =============================================================================

vi.mock('../src/services/wsTicketStore', () => ({
  consumeTicket: (...args: unknown[]) => mockConsumeTicket(...args),
  startTicketCleanup: (...args: unknown[]) => mockStartTicketCleanup(...args),
  stopTicketCleanup: (...args: unknown[]) => mockStopTicketCleanup(...args),
}));

vi.mock('../src/lib/connectionPoolClient', () => ({
  prisma: {
    standardChatMessages: { create: (...args: unknown[]) => mockPrismaCreate(...args) },
    standardChats: { update: (...args: unknown[]) => mockPrismaUpdate(...args) },
    users: { findUnique: (...args: unknown[]) => mockPrismaFindUnique(...args) },
  },
}));

vi.mock('../src/util/sanitize.js', () => ({}));

vi.mock('../src/supabase/supabaseS3Client.js', () => ({
  s3Client: {},
  S3_BUCKET_NAME: 'test-bucket',
}));

vi.mock('../src/services/imageUpload.js', () => ({
  resolveImageUrl: (url: string | null) => Promise.resolve(url),
  signImageUrl: (url: string) => Promise.resolve(url),
}));

vi.mock('ws', () => {
  const { wss, clients } = createMockWss();
  return {
    WebSocketServer: vi.fn().mockImplementation(function () {
      (wss as Record<string, unknown>).clients = clients;
      return wss;
    }),
    WebSocket: { OPEN: 1, CLOSED: 3 },
  };
});

// =============================================================================
// Import under test
// =============================================================================

import {
  broadcastToRoom,
  sendToUser,
  removeSocketFromAllRooms,
  setupWebSocket,
  shutdownWebSocket,
} from './websocket';

// =============================================================================
// Helpers
// =============================================================================

type MockWs = ReturnType<typeof createMockWs>;

async function connectAndAuth(ticket: string, userId: string): Promise<MockWs> {
  const ws = createMockWs();
  ws.url = `/ws?ticket=${ticket}`;
  mockConsumeTicket.mockReturnValue(userId);
  const { wss } = getMockWss();
  wss.emit('connection', ws, { url: `/ws?ticket=${ticket}` });
  await vi.waitFor(() => expect(ws.userName).toBeDefined());
  return ws;
}

async function setupWsAndConnect(ticket: string, userId: string): Promise<MockWs> {
  setupWebSocket(getMockHttpServer() as unknown as import('http').Server);
  return connectAndAuth(ticket, userId);
}

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockConsumeTicket.mockReset();
  mockPrismaCreate.mockReset();
  mockPrismaUpdate.mockReset();
  mockPrismaFindUnique.mockReset();
  mockPrismaFindUnique.mockResolvedValue({ user_name: 'Alice', image_url: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// 1. setupWebSocket / shutdownWebSocket
// =============================================================================

describe('setupWebSocket / shutdownWebSocket', () => {
  it('attaches WebSocketServer to provided HTTP server and starts ticket cleanup', () => {
    setupWebSocket(getMockHttpServer() as unknown as import('http').Server);
    expect(mockStartTicketCleanup).toHaveBeenCalled();
    shutdownWebSocket();
    expect(mockStopTicketCleanup).toHaveBeenCalled();
  });

  it('shutdownWebSocket closes the WSS', () => {
    setupWebSocket(getMockHttpServer() as unknown as import('http').Server);
    shutdownWebSocket();
  });
});

// =============================================================================
// 2. Authentication
// =============================================================================

describe('Authentication', () => {
  it('authenticates connection with valid ticket', async () => {
    const ws = await setupWsAndConnect('valid-ticket', 'user-1');
    expect(mockConsumeTicket).toHaveBeenCalledWith('valid-ticket');
    expect(ws.userId).toBe('user-1');
    expect(ws.isAlive).toBe(true);
    expect(ws.subscribedRooms).toBeDefined();
  });

  it('closes socket with code 4001 on invalid ticket', () => {
    setupWebSocket(getMockHttpServer() as unknown as import('http').Server);
    const ws = createMockWs();
    ws.url = '/ws?ticket=bad';
    mockConsumeTicket.mockReturnValue(null);
    const closeSpy = vi.spyOn(ws, 'close');
    const { wss } = getMockWss();
    wss.emit('connection', ws, { url: '/ws?ticket=bad' });

    expect(closeSpy).toHaveBeenCalledWith(4001, 'Authentication required');
    expect(ws.userId).toBeUndefined();
  });

  it('closes socket with code 4001 when no ticket', () => {
    setupWebSocket(getMockHttpServer() as unknown as import('http').Server);
    const ws = createMockWs();
    const closeSpy = vi.spyOn(ws, 'close');
    const { wss } = getMockWss();
    wss.emit('connection', ws, { url: '/ws' });

    expect(closeSpy).toHaveBeenCalledWith(4001, 'Authentication required');
  });

  it('loads user profile from DB after auth', async () => {
    mockPrismaFindUnique.mockResolvedValue({ user_name: 'Alice', image_url: 'http://img.com/a.png' });
    const ws = await setupWsAndConnect('t1', 'user-1');

    expect(mockPrismaFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { user_name: true, image_url: true },
    });
    expect(ws.userName).toBe('Alice');
    expect(ws.userImage).toBe('http://img.com/a.png');
  });

  it('falls back to userId when profile not found', async () => {
    mockPrismaFindUnique.mockResolvedValue(null);
    const ws = await setupWsAndConnect('t1', 'user-1');

    expect(ws.userName).toBe('user-1');
    expect(ws.userImage).toBeNull();
  });

  it('falls back to userId on DB error', async () => {
    mockPrismaFindUnique.mockRejectedValue(new Error('DB down'));
    const ws = await setupWsAndConnect('t1', 'user-1');

    expect(ws.userName).toBe('user-1');
    expect(ws.userImage).toBeNull();
  });
});

// =============================================================================
// 3. broadcastToRoom
// =============================================================================

describe('broadcastToRoom', () => {
  it('sends data to all subscribed sockets in room', async () => {
    const ws1 = await setupWsAndConnect('t1', 'user-1');
    const ws2 = await setupWsAndConnect('t2', 'user-2');
    ws1.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1'] } })));
    ws2.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1'] } })));
    ws1.sent.length = 0;
    ws2.sent.length = 0;

    const data = { type: 'message:new', payload: { id: 'm1' } };
    broadcastToRoom('chat-1', data);

    expect(ws1.sent).toHaveLength(1);
    expect(ws2.sent).toHaveLength(1);
    expect(JSON.parse(ws1.sent[0])).toEqual(data);
    expect(JSON.parse(ws2.sent[0])).toEqual(data);
  });

  it('does nothing for non-existent room', () => {
    broadcastToRoom('empty-room', { type: 'test' });
  });
});

// =============================================================================
// 4. sendToUser
// =============================================================================

describe('sendToUser', () => {
  it('sends data to connected user', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    const data = { type: 'notification:new', payload: { id: 'n1' } };
    sendToUser('user-1', data);

    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toEqual(data);
  });

  it('does nothing for disconnected user', () => {
    sendToUser('nonexistent', { type: 'test' });
  });
});

// =============================================================================
// 5. Message Sending
// =============================================================================

describe('Message Sending', () => {
  it('sends message:ack to sender after DB save', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    mockPrismaCreate.mockResolvedValue({ id: 'msg-1', content: 'hello', created_at: new Date() });
    mockPrismaUpdate.mockResolvedValue({});

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'message:send', payload: { chatId: 'chat-1', content: 'hello', tempId: 'tmp-1' } })));

    await vi.waitFor(() => {
      const ack = ws.sent.find((s) => JSON.parse(s).type === 'message:ack');
      expect(ack).toBeDefined();
      expect(JSON.parse(ack!).payload.id).toBe('msg-1');
      expect(JSON.parse(ack!).payload.tempId).toBe('tmp-1');
    });
  });

  it('rejects empty content', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'message:send', payload: { chatId: 'chat-1', content: '' } })));

    await vi.waitFor(() => {
      const error = ws.sent.find((s) => JSON.parse(s).type === 'error');
      expect(error).toBeDefined();
      expect(JSON.parse(error!).payload.message).toContain('content');
    });
    expect(mockPrismaCreate).not.toHaveBeenCalled();
  });

  it('rejects message when userId is undefined', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    ws.userId = undefined;
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'message:send', payload: { chatId: 'chat-1', content: 'hi' } })));

    await vi.waitFor(() => {
      expect(ws.sent.length).toBeGreaterThan(0);
    });
  });

  it('rejects message when userName is undefined', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    ws.userName = undefined;
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'message:send', payload: { chatId: 'chat-1', content: 'hi' } })));

    await vi.waitFor(() => {
      const error = ws.sent.find((s) => JSON.parse(s).type === 'error');
      expect(error).toBeDefined();
    });
    expect(mockPrismaCreate).not.toHaveBeenCalled();
  });

  it('sends error on DB failure', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    mockPrismaCreate.mockRejectedValue(new Error('DB error'));
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'message:send', payload: { chatId: 'chat-1', content: 'hello' } })));

    await vi.waitFor(() => {
      const error = ws.sent.find((s) => JSON.parse(s).type === 'error');
      expect(error).toBeDefined();
      expect(JSON.parse(error!).payload.message).toBe('Failed to send message');
    });
  });

  it('stores message content as-is without sanitization', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    mockPrismaCreate.mockResolvedValue({ id: 'msg-1', content: '<script>alert("xss")</script>', created_at: new Date() });
    mockPrismaUpdate.mockResolvedValue({});
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'message:send', payload: { chatId: 'chat-1', content: '<script>alert("xss")</script>' } })));

    await vi.waitFor(() => {
      expect(mockPrismaCreate).toHaveBeenCalledWith({
        data: { chat_id: 'chat-1', sender_id: 'user-1', content: '<script>alert("xss")</script>' },
      });
    });
  });

  it('updates standardChats.updated_at after message save', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    mockPrismaCreate.mockResolvedValue({ id: 'msg-1', content: 'hi', created_at: new Date() });
    mockPrismaUpdate.mockResolvedValue({});
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'message:send', payload: { chatId: 'chat-1', content: 'hi' } })));

    await vi.waitFor(() => {
      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { id: 'chat-1' },
        data: { updated_at: expect.any(Date) },
      });
    });
  });
});

// =============================================================================
// 6. Subscribe / Unsubscribe
// =============================================================================

describe('Subscribe / Unsubscribe', () => {
  it('subscribes to chats and sends confirmation', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1', 'chat-2'] } })));

    const sub = ws.sent.find((s) => JSON.parse(s).type === 'subscribed');
    expect(sub).toBeDefined();
    expect(JSON.parse(sub!).payload.chatIds).toEqual(['chat-1', 'chat-2']);
  });

  it('broadcasts user:online to room after subscribe', async () => {
    const ws1 = await setupWsAndConnect('t1', 'user-1');
    const ws2 = await setupWsAndConnect('t2', 'user-2');

    ws1.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1'] } })));
    ws1.sent.length = 0;
    ws2.sent.length = 0;

    ws2.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1'] } })));

    const onlineMsg = ws1.sent.find((s) => JSON.parse(s).type === 'user:online');
    expect(onlineMsg).toBeDefined();
    expect(JSON.parse(onlineMsg!).payload.chatId).toBe('chat-1');
    expect(JSON.parse(onlineMsg!).payload.userId).toBe('user-2');
  });

  it('sends chat:online-users after subscribe', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    ws.sent.length = 0;
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1'] } })));

    const onlineUsers = ws.sent.find((s) => JSON.parse(s).type === 'chat:online-users');
    expect(onlineUsers).toBeDefined();
    expect(JSON.parse(onlineUsers!).payload.userIds).toContain('user-1');
  });

  it('ignores subscribe when userId is undefined', async () => {
    setupWebSocket(getMockHttpServer() as unknown as import('http').Server);
    const ws = createMockWs();
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1'] } })));
    expect(ws.sent).toHaveLength(0);
  });

  it('unsubscribes and broadcasts user:offline', async () => {
    const ws1 = await setupWsAndConnect('t1', 'user-1');
    const ws2 = await setupWsAndConnect('t2', 'user-2');

    ws1.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1'] } })));
    ws2.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1'] } })));

    ws1.sent.length = 0;
    ws2.sent.length = 0;

    ws1.emit('message', Buffer.from(JSON.stringify({ type: 'unsubscribe', payload: { chatIds: ['chat-1'] } })));

    const unsub = ws1.sent.find((s) => JSON.parse(s).type === 'unsubscribed');
    expect(unsub).toBeDefined();

    const offline = ws2.sent.find((s) => JSON.parse(s).type === 'user:offline');
    expect(offline).toBeDefined();
    expect(JSON.parse(offline!).payload.userId).toBe('user-1');
  });
});

// =============================================================================
// 7. Typing Indicators
// =============================================================================

describe('Typing Indicators', () => {
  it('broadcasts typing:start to room', async () => {
    const ws1 = await setupWsAndConnect('t1', 'user-1');
    const ws2 = await setupWsAndConnect('t2', 'user-2');

    ws1.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1'] } })));
    ws2.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1'] } })));

    ws2.sent.length = 0;
    ws1.emit('message', Buffer.from(JSON.stringify({ type: 'typing:start', payload: { chatId: 'chat-1' } })));

    const typing = ws2.sent.find((s) => JSON.parse(s).type === 'typing:update');
    expect(typing).toBeDefined();
    expect(JSON.parse(typing!).payload.isTyping).toBe(true);
    expect(JSON.parse(typing!).payload.userId).toBe('user-1');
  });

  it('broadcasts typing:stop to room', async () => {
    const ws1 = await setupWsAndConnect('t1', 'user-1');
    const ws2 = await setupWsAndConnect('t2', 'user-2');

    ws1.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1'] } })));
    ws2.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1'] } })));

    ws2.sent.length = 0;
    ws1.emit('message', Buffer.from(JSON.stringify({ type: 'typing:stop', payload: { chatId: 'chat-1' } })));

    const typing = ws2.sent.find((s) => JSON.parse(s).type === 'typing:update');
    expect(typing).toBeDefined();
    expect(JSON.parse(typing!).payload.isTyping).toBe(false);
  });

  it('ignores typing when userId is undefined', async () => {
    setupWebSocket(getMockHttpServer() as unknown as import('http').Server);
    const ws = createMockWs();
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'typing:start', payload: { chatId: 'chat-1' } })));
    expect(ws.sent).toHaveLength(0);
  });
});

// =============================================================================
// 8. Invalid JSON / Unknown Types
// =============================================================================

describe('Invalid JSON / Unknown Types', () => {
  it('sends error on invalid JSON', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    ws.emit('message', Buffer.from('not json'));

    const error = ws.sent.find((s) => JSON.parse(s).type === 'error');
    expect(error).toBeDefined();
    expect(JSON.parse(error!).payload.message).toBe('Invalid JSON');
  });

  it('sends error on unknown message type', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'unknown:type', payload: {} })));

    const error = ws.sent.find((s) => JSON.parse(s).type === 'error');
    expect(error).toBeDefined();
    expect(JSON.parse(error!).payload.message).toContain('Unknown type');
  });
});

// =============================================================================
// 9. Close / Disconnect
// =============================================================================

describe('Close / Disconnect', () => {
  it('removes socket from rooms and broadcasts user:offline on close', async () => {
    const ws1 = await setupWsAndConnect('t1', 'user-1');
    const ws2 = await setupWsAndConnect('t2', 'user-2');

    ws1.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1'] } })));
    ws2.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1'] } })));

    ws2.sent.length = 0;
    ws1.emit('close');

    const offline = ws2.sent.find((s) => JSON.parse(s).type === 'user:offline');
    expect(offline).toBeDefined();
    expect(JSON.parse(offline!).payload.userId).toBe('user-1');
  });

  it('removes socket from userSockets on close', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    ws.emit('close');

    sendToUser('user-1', { type: 'test' });
    expect(ws.sent).toHaveLength(0);
  });

  it('handles close for socket with no subscribed rooms', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    ws.subscribedRooms = undefined;
    ws.emit('close');
  });

  it('handles error event on socket', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    ws.emit('error', new Error('test'));
    ws.emit('close');

    sendToUser('user-1', { type: 'test' });
    expect(ws.sent).toHaveLength(0);
  });
});

// =============================================================================
// 10. removeSocketFromAllRooms
// =============================================================================

describe('removeSocketFromAllRooms', () => {
  it('removes socket from all subscribed rooms', async () => {
    const ws = await setupWsAndConnect('t1', 'user-1');
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'subscribe', payload: { chatIds: ['chat-1', 'chat-2'] } })));

    expect(ws.subscribedRooms?.size).toBe(2);
    removeSocketFromAllRooms(ws);
    expect(ws.subscribedRooms?.size).toBe(0);
  });

  it('does nothing when subscribedRooms is undefined', () => {
    const ws = createMockWs();
    removeSocketFromAllRooms(ws);
  });
});
