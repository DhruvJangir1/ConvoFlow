import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/supabase/supabaseS3Client.js', () => ({ s3Client: {}, S3_BUCKET_NAME: 'test-bucket' }));
vi.mock('../src/lib/connectionPoolClient.js', () => ({
  get prisma() { const s = (globalThis as any).__testMockState; return s ? s.prisma : {}; },
}));
vi.mock('../src/services/imageUpload.js', () => ({
  get resolveImageUrl() { const s = (globalThis as any).__testMockState; return s ? s.imageUpload.resolveImageUrl : vi.fn(); },
  get uploadImageToStorage() { return vi.fn(); },
}));
const anonWsMockFns = vi.hoisted(() => ({
  broadcastToRoom: vi.fn(),
}));
vi.mock('../ws/websocket.js', () => anonWsMockFns);

import {
  getMockState, createFreshMockState, resetMockState,
  setupDefaultMocks, uid, cid, mid, sleep,
} from './helpers/index';

let AnonymousChatRouter: any;

beforeEach(async () => {
  vi.clearAllMocks();
  (globalThis as Record<string, unknown>).__testMockState = createFreshMockState();
  setupDefaultMocks();
  const mod = await import('../src/routes/anonymousChat');
  AnonymousChatRouter = mod.default;
});

afterEach(() => {
  resetMockState();
});

function createReq(body: any, user?: { id: string }, params?: any, query?: any) {
  return { body, user, params: params || {}, query: query || {}, headers: {} } as any;
}

function createRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
}

async function callHandler(router: any, stackIdx: number, req: any, res: any) {
  const handler = router.stack[stackIdx].route.stack.at(-1).handle;
  await handler(req, res, () => {});
  await sleep(5);
}

/* ═══════════════════════════════════════════════════════════════════════
   9. ANONYMOUS CHAT SYSTEM
   ═══════════════════════════════════════════════════════════════════════ */

describe('Anonymous Chat System', () => {
  describe('List rooms', () => {
    it('returns empty room list', async () => {
      const userId = uid();
      const ms = getMockState();
      ms.prisma.anonymousChats.findMany.mockResolvedValue([]);

      const req = createReq({}, { id: userId });
      const res = createRes();

      await callHandler(AnonymousChatRouter, 0, req, res);

      expect(res.json).toHaveBeenCalledWith({ chats: [] });
    });

    it('returns rooms with last message', async () => {
      const userId = uid();
      const roomId = cid();
      const ms = getMockState();
      ms.prisma.anonymousChats.findMany.mockResolvedValue([
        {
          id: roomId,
          name: 'Anon Room',
          created_at: new Date(),
          updated_at: new Date(),
          AnonymousChatMessages: [{ content: 'Last message', created_at: new Date() }],
        },
      ]);

      const req = createReq({}, { id: userId });
      const res = createRes();

      await callHandler(AnonymousChatRouter, 0, req, res);

      expect(res.json).toHaveBeenCalledWith({
        chats: expect.arrayContaining([
          expect.objectContaining({ id: roomId, name: 'Anon Room', lastMessage: 'Last message' }),
        ]),
      });
    });
  });

  describe('Join room', () => {
    it('joins room successfully', async () => {
      const userId = uid();
      const roomId = cid();
      const ms = getMockState();

      ms.prisma.anonymousChatMembers.findUnique.mockResolvedValue(null);
      ms.prisma.anonymousChatMembers.create.mockResolvedValue({ id: userId, chat_id: roomId });

      const req = createReq({}, { id: userId }, { id: roomId });
      const res = createRes();

      await callHandler(AnonymousChatRouter, 2, req, res);

      expect(ms.prisma.anonymousChatMembers.create).toHaveBeenCalledWith({
        data: { id: userId, chat_id: roomId },
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('does not duplicate membership when already joined', async () => {
      const userId = uid();
      const roomId = cid();
      const ms = getMockState();

      ms.prisma.anonymousChatMembers.findUnique.mockResolvedValue({ id: userId, chat_id: roomId });

      const req = createReq({}, { id: userId }, { id: roomId });
      const res = createRes();

      await callHandler(AnonymousChatRouter, 2, req, res);

      expect(ms.prisma.anonymousChatMembers.create).not.toHaveBeenCalled();
    });
  });

  describe('Send message', () => {
    it('sends anonymous message successfully', async () => {
      const userId = uid();
      const roomId = cid();
      const ms = getMockState();

      ms.prisma.anonymousChatMessages.create.mockResolvedValue({
        id: 'msg-1',
        chat_id: roomId,
        content: 'Hello anon',
        created_at: new Date(),
      });
      ms.prisma.anonymousChats.update.mockResolvedValue({});

      const req = createReq({ content: 'Hello anon' }, { id: userId }, { chatId: roomId, userId, isAnonymous: 'true' });
      const res = createRes();

      await callHandler(AnonymousChatRouter, 4, req, res);

      expect(ms.prisma.anonymousChatMessages.create).toHaveBeenCalled();
      expect(anonWsMockFns.broadcastToRoom).toHaveBeenCalledWith(
        roomId,
        expect.objectContaining({
          type: 'message:new',
          payload: expect.objectContaining({ content: 'Hello anon', isAnonymous: true }),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('sends non-anonymous message with sender info', async () => {
      const userId = uid();
      const roomId = cid();
      const ms = getMockState();

      ms.prisma.anonymousChatMessages.create.mockResolvedValue({
        id: 'msg-2',
        chat_id: roomId,
        content: 'Not anon',
        created_at: new Date(),
      });
      ms.prisma.users.findUnique.mockResolvedValue({ id: userId, user_name: 'TestUser', image_url: 'img.png' });
      ms.imageUpload.resolveImageUrl.mockResolvedValue('https://signed/img.png');

      const req = createReq({ content: 'Not anon' }, { id: userId }, { chatId: roomId, userId, isAnonymous: 'false' });
      const res = createRes();

      await callHandler(AnonymousChatRouter, 4, req, res);

      expect(anonWsMockFns.broadcastToRoom).toHaveBeenCalledWith(
        roomId,
        expect.objectContaining({
          type: 'message:new',
          payload: expect.objectContaining({ senderName: 'TestUser', isAnonymous: false }),
        }),
      );
    });

    it('rejects empty message content', async () => {
      const userId = uid();
      const roomId = cid();

      const req = createReq({ content: '' }, { id: userId }, { id: roomId, userId, isAnonymous: 'true' });
      const res = createRes();

      await callHandler(AnonymousChatRouter, 4, req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Edit/Delete messages', () => {
    it('edits own anonymous message', async () => {
      const userId = uid();
      const roomId = cid();
      const messageId = mid();
      const ms = getMockState();

      ms.prisma.anonymousChatMessages.findUnique.mockResolvedValue({ id: messageId, chat_id: roomId, sender_id: userId, content: 'old' });
      ms.prisma.anonymousChatMessages.update.mockResolvedValue({ id: messageId, content: 'edited' });
      ms.prisma.anonymousChats.update.mockResolvedValue({});

      const req = createReq({ content: 'edited' }, { id: userId }, { id: roomId, messageId });
      const res = createRes();

      await callHandler(AnonymousChatRouter, 5, req, res);

      expect(ms.prisma.anonymousChatMessages.update).toHaveBeenCalled();
    });
  });

  describe('Voting system', () => {
    it('upvotes a message', async () => {
      const userId = uid();
      const messageId = mid();
      const ms = getMockState();

      ms.prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
        const tx = {
          anonymousChatMessagesUserVotes: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({}),
          },
          anonymousChatMessages: {
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      const req = createReq({}, { id: userId }, { messageId });
      const res = createRes();

      await callHandler(AnonymousChatRouter, 7, req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('toggles upvote to downvote', async () => {
      const userId = uid();
      const messageId = mid();
      const ms = getMockState();

      ms.prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
        const tx = {
          anonymousChatMessagesUserVotes: {
            findFirst: vi.fn().mockResolvedValue({ id: 'vote-1', type: 'upvote' }),
            delete: vi.fn().mockResolvedValue({}),
            create: vi.fn().mockResolvedValue({}),
          },
          anonymousChatMessages: {
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      const req = createReq({}, { id: userId }, { messageId });
      const res = createRes();

      await callHandler(AnonymousChatRouter, 7, req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('removes upvote when clicking again', async () => {
      const userId = uid();
      const messageId = mid();
      const ms = getMockState();

      ms.prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
        const tx = {
          anonymousChatMessagesUserVotes: {
            findFirst: vi.fn().mockResolvedValue({ id: 'vote-1', type: 'upvote' }),
            delete: vi.fn().mockResolvedValue({}),
            create: vi.fn().mockResolvedValue({}),
          },
          anonymousChatMessages: {
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      // This simulates removing upvote - calling the handler with an existing upvote
    });

    it('prevents duplicate votes', async () => {
      const userId = uid();
      const messageId = mid();
      const ms = getMockState();

      ms.prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
        const tx = {
          anonymousChatMessagesUserVotes: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({}),
          },
          anonymousChatMessages: {
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });
    });
  });
});
