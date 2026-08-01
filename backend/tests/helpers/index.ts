import { vi } from 'vitest';
import type { EventEmitter } from 'events';

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface MockWsInstance {
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
  addListener: (event: string, fn: (...args: unknown[]) => void) => void;
  removeListener: (event: string, fn: (...args: unknown[]) => void) => void;
}

export interface MockWSS {
  _listeners: Record<string, ((...args: unknown[]) => void)[]>;
  _connHandler: ((ws: unknown, req: { url: string }) => void) | undefined;
  clients: Set<unknown>;
  on: (event: string, fn: (...args: unknown[]) => void) => MockWSS;
  emit: (event: string, ...args: unknown[]) => boolean;
  listeners: (event: string) => ((...args: unknown[]) => void)[];
  close: () => void;
}

export interface MockState {
  consumeTicket: ReturnType<typeof vi.fn>;
  startTicketCleanup: ReturnType<typeof vi.fn>;
  stopTicketCleanup: ReturnType<typeof vi.fn>;
  prisma: {
    users: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    standardChatMembers: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      createMany: ReturnType<typeof vi.fn>;
    };
    standardChatMessages: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    standardChats: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    addFriendRequests: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    notifications: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    anonymousChats: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    anonymousChatMembers: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    anonymousChatMessages: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    anonymousChatMessagesUserVotes: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
    $transaction: ReturnType<typeof vi.fn>;
    clerkUsers: {
      upsert: ReturnType<typeof vi.fn>;
    };
  };
  mockWsInstances: MockWsInstance[];
  mockWsInstanceMap: Map<string, MockWsInstance>;
  imageUpload: {
    uploadImageToStorage: ReturnType<typeof vi.fn>;
    resolveImageUrl: ReturnType<typeof vi.fn>;
    signImageUrl: ReturnType<typeof vi.fn>;
  };
  sendFriendRequestEmail: ReturnType<typeof vi.fn>;
  notifyFriendRequest: ReturnType<typeof vi.fn>;
  sendToUser: ReturnType<typeof vi.fn>;
  broadcastToRoom: ReturnType<typeof vi.fn>;
  broadcastMessageToRoom: ReturnType<typeof vi.fn>;
  createDmChat: ReturnType<typeof vi.fn>;
}

/* ─── Event Emitter Factory ──────────────────────────────────────────── */

export function makeEventEmitter() {
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

/* ─── Mock State Singleton ──────────────────────────────────────────── */

export function getMockState(): MockState {
  const g = globalThis as Record<string, unknown>;
  if (!g.__testMockState) {
    g.__testMockState = createFreshMockState();
  }
  return g.__testMockState as MockState;
}

export function createFreshMockState(): MockState {
  return {
    consumeTicket: vi.fn<(ticket: string) => string | null>(),
    startTicketCleanup: vi.fn(),
    stopTicketCleanup: vi.fn(),
    prisma: {
      users: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      standardChatMembers: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        createMany: vi.fn(),
      },
      standardChatMessages: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      standardChats: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      addFriendRequests: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      notifications: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      anonymousChats: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      anonymousChatMembers: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      anonymousChatMessages: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      anonymousChatMessagesUserVotes: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
      clerkUsers: {
        upsert: vi.fn(),
      },
    },
    mockWsInstances: [],
    mockWsInstanceMap: new Map(),
    imageUpload: {
      uploadImageToStorage: vi.fn(),
      resolveImageUrl: vi.fn(),
      signImageUrl: vi.fn(),
    },
    sendFriendRequestEmail: vi.fn(),
    notifyFriendRequest: vi.fn(),
    sendToUser: vi.fn(),
    broadcastToRoom: vi.fn(),
    broadcastMessageToRoom: vi.fn(),
    createDmChat: vi.fn(),
  };
}

export function resetMockState(): void {
  (globalThis as Record<string, unknown>).__testMockState = undefined;
  (globalThis as Record<string, unknown>).__mockWss = undefined;
}

export function getMockWss(): MockWSS {
  return (globalThis as Record<string, unknown>).__mockWss as MockWSS;
}

/* ─── ID Generators ─────────────────────────────────────────────────── */

let testCounter = 0;
export function uid() { return `user-${++testCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
export function cid() { return `chat-${++testCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
export function mid() { return `msg-${++testCounter}-${Date.now()}`; }

/* ─── Mock WS Factory ───────────────────────────────────────────────── */

export function createMockWs(): MockWsInstance {
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
    addListener: (event: string, fn: (...args: unknown[]) => void) => { ee.on(event, fn); },
    removeListener: (event: string, fn: (...args: unknown[]) => void) => {
      const fns = ee._listeners[event];
      if (fns) {
        const idx = fns.indexOf(fn);
        if (idx >= 0) fns.splice(idx, 1);
      }
    },
  };
  getMockState().mockWsInstances.push(ws);
  return ws;
}

/* ─── Connection Emitter ────────────────────────────────────────────── */

export function emitConnection(ticket: string): MockWsInstance {
  const wss = getMockWss();
  const ws = createMockWs();
  if (wss._connHandler) {
    wss._connHandler(ws as unknown, { url: `/ws?ticket=${ticket}` });
  }
  return ws;
}

export function cleanEmitConnection(userId: string, ticket: string): MockWsInstance {
  const ms = getMockState();
  ms.consumeTicket.mockReturnValue(userId);
  return emitConnection(ticket);
}

/* ─── Parse Helpers ─────────────────────────────────────────────────── */

export function getAllSent(ws: MockWsInstance) {
  return ws.sent.map((raw) => JSON.parse(raw) as { type: string; payload: Record<string, unknown> });
}

export function getMessagesOfType(ws: MockWsInstance, type: string) {
  return getAllSent(ws).filter((m) => m.type === type);
}

export function sleep(ms = 15) { return new Promise((r) => setTimeout(r, ms)); }
export function sleepLong(ms = 100) { return new Promise((r) => setTimeout(r, ms)); }

/* ─── Default Mocks ─────────────────────────────────────────────────── */

export function setupDefaultMocks() {
  const ms = getMockState();
  ms.prisma.users.findUnique.mockResolvedValue({ id: uid(), user_name: 'TestUser', image_url: 'https://img.test/a.png' });
  ms.prisma.users.findFirst.mockResolvedValue(null);
  ms.prisma.users.findMany.mockResolvedValue([]);
  ms.prisma.users.update.mockResolvedValue({});
  ms.prisma.users.create.mockResolvedValue({ id: uid(), email: 'test@test.com' });

  ms.prisma.standardChatMembers.findUnique.mockResolvedValue({ user_id: 'member' });
  ms.prisma.standardChatMembers.findMany.mockImplementation(async (args: { where?: { chat_id?: { in?: string[] } } }) => {
    const chatIds = args?.where?.chat_id?.in ?? [];
    return chatIds.map((chat_id: string) => ({ chat_id }));
  });
  ms.prisma.anonymousChatMembers.findMany.mockImplementation(async (args: { where?: { chat_id?: { in?: string[] } } }) => {
    const chatIds = args?.where?.chat_id?.in ?? [];
    return chatIds.map((chat_id: string) => ({ chat_id }));
  });

  ms.prisma.standardChatMessages.findUnique.mockResolvedValue(null);
  ms.prisma.standardChatMessages.findMany.mockResolvedValue([]);
  ms.prisma.standardChatMessages.create.mockResolvedValue({});

  ms.prisma.standardChats.findUnique.mockResolvedValue(null);
  ms.prisma.standardChats.findMany.mockResolvedValue([]);
  ms.prisma.standardChats.update.mockResolvedValue({});

  ms.prisma.addFriendRequests.findUnique.mockResolvedValue(null);
  ms.prisma.addFriendRequests.findFirst.mockResolvedValue(null);
  ms.prisma.addFriendRequests.findMany.mockResolvedValue([]);
  ms.prisma.addFriendRequests.create.mockResolvedValue({});
  ms.prisma.addFriendRequests.update.mockResolvedValue({});
  ms.prisma.addFriendRequests.count.mockResolvedValue(0);

  ms.prisma.notifications.findUnique.mockResolvedValue(null);
  ms.prisma.notifications.findFirst.mockResolvedValue(null);
  ms.prisma.notifications.findMany.mockResolvedValue([]);
  ms.prisma.notifications.create.mockResolvedValue({});
  ms.prisma.notifications.update.mockResolvedValue({});
  ms.prisma.notifications.updateMany.mockResolvedValue({});

  ms.prisma.anonymousChats.findUnique.mockResolvedValue(null);
  ms.prisma.anonymousChats.findMany.mockResolvedValue([]);
  ms.prisma.anonymousChats.update.mockResolvedValue({});

  ms.prisma.anonymousChatMembers.findUnique.mockResolvedValue(null);
  ms.prisma.anonymousChatMembers.create.mockResolvedValue({});

  ms.prisma.anonymousChatMessages.findUnique.mockResolvedValue(null);
  ms.prisma.anonymousChatMessages.findMany.mockResolvedValue([]);
  ms.prisma.anonymousChatMessages.create.mockResolvedValue({});
  ms.prisma.anonymousChatMessages.update.mockResolvedValue({});

  ms.prisma.anonymousChatMessagesUserVotes.findFirst.mockResolvedValue(null);
  ms.prisma.anonymousChatMessagesUserVotes.findMany.mockResolvedValue([]);
  ms.prisma.anonymousChatMessagesUserVotes.create.mockResolvedValue({});
  ms.prisma.anonymousChatMessagesUserVotes.delete.mockResolvedValue({});

  ms.prisma.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const id = values[0] as string;
    return [{ id, createdAt: new Date() }];
  });
  ms.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const tx = { ...ms.prisma };
    return fn(tx);
  });
  ms.prisma.clerkUsers.upsert.mockResolvedValue({});

  ms.imageUpload.uploadImageToStorage.mockResolvedValue({ url: 'https://s3.test/image.png', path: 'images/test.png' });
  ms.imageUpload.resolveImageUrl.mockResolvedValue('https://s3.test/signed/image.png');
  ms.imageUpload.signImageUrl.mockResolvedValue('https://s3.test/signed/image.png');

  ms.sendFriendRequestEmail.mockResolvedValue(undefined);
  ms.notifyFriendRequest.mockImplementation(async (receiverId: string, senderId: string, senderName: string, requestId: string) => {
    return {
      friendRequest: { id: requestId, status: 'pending' },
      notification: { id: `notif-${requestId}`, type: 'friend_request' },
    };
  });

  ms.sendToUser.mockImplementation(() => {});
  ms.broadcastToRoom.mockImplementation(() => {});
  ms.broadcastMessageToRoom.mockImplementation(() => {});

  ms.createDmChat.mockImplementation(async (userA: string, userB: string) => {
    const chatId = cid();
    return {
      id: chatId,
      type: 'dm',
      StandardChatMembers: [
        { user_id: userA, USERS: { id: userA, user_name: 'UserA', image_url: null } },
        { user_id: userB, USERS: { id: userB, user_name: 'UserB', image_url: null } },
      ],
    };
  });
}

export function setupWsTestServer() {
  const server = { on: vi.fn() };
  setupDefaultMocks();
  (globalThis as Record<string, unknown>).__mockWss = undefined;
  getMockState().mockWsInstances.length = 0;
  getMockState().mockWsInstanceMap.clear();
  return server;
}

export function registerConnHandler() {
  const wss = getMockWss();
  if (wss) {
    const listeners = wss.listeners('connection');
    if (listeners.length > 0) {
      wss._connHandler = listeners[listeners.length - 1] as (ws: unknown, req: { url: string }) => void;
    }
  }
}
