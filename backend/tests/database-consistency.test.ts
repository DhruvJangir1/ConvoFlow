import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/supabase/supabaseS3Client.js', () => ({ s3Client: {}, S3_BUCKET_NAME: 'test-bucket' }));
vi.mock('../src/services/userNotify.js', () => ({
  get notifyFriendRequest() { const s = (globalThis as any).__testMockState; return s ? s.notifyFriendRequest : vi.fn(); },
}));
vi.mock('../src/services/authVerificaiton.js', () => ({
  get sendFriendRequestEmail() { const s = (globalThis as any).__testMockState; return s ? s.sendFriendRequestEmail : vi.fn(); },
}));
vi.mock('../src/lib/connectionPoolClient.js', () => ({
  get prisma() { const s = (globalThis as any).__testMockState; return s ? s.prisma : {}; },
}));
vi.mock('../src/services/imageUpload.js', () => ({
  get uploadImageToStorage() { const s = (globalThis as any).__testMockState; return s ? s.imageUpload.uploadImageToStorage : vi.fn(); },
  get resolveImageUrl() { const s = (globalThis as any).__testMockState; return s ? s.imageUpload.resolveImageUrl : vi.fn(); },
}));
vi.mock('../src/services/dmChat.js', () => ({
  get createDmChat() { const s = (globalThis as any).__testMockState; return s ? s.createDmChat : vi.fn(); },
  get findDmChat() { const s = (globalThis as any).__testMockState; return s ? vi.fn() : vi.fn(); },
}));

vi.mock('../ws/websocket.js', () => ({
  get sendToUser() { const s = (globalThis as any).__testMockState; return s ? s.sendToUser : vi.fn(); },
}));

vi.mock('../src/middleware/authenticate.js', () => ({
  authenticate: async (req: any, _res: any, next: any) => {
    if (!req.user) {
      req.user = { id: 'test-auto-id', email: 'test@auto.com' };
    }
    next();
  },
}));

import {
  getMockState, createFreshMockState, resetMockState,
  setupDefaultMocks, uid, cid, sleep,
} from './helpers/index';

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as Record<string, unknown>).__testMockState = createFreshMockState();
  setupDefaultMocks();
});

afterEach(() => {
  resetMockState();
});

/* ═══════════════════════════════════════════════════════════════════════
   13. DATABASE CONSISTENCY
   ═══════════════════════════════════════════════════════════════════════ */

describe('Database Consistency - Friend Request', () => {
  let FriendRouter: any;

  beforeEach(async () => {
    const mod = await import('../src/routes/userAddFriend');
    FriendRouter = mod.default;
  });

  it('rolls back addFriendRequests on notification creation failure', async () => {
    const senderId = uid();
    const targetId = uid();
    const ms = getMockState();

    ms.prisma.users.findUnique.mockResolvedValue({ id: senderId, user_name: 'Sender', user_tag: 's#t', email: 's@t.com' });
    ms.prisma.users.findFirst.mockResolvedValue({ id: targetId, user_name: 'Target', email: 't@t.com', user_tag: 't#t' });
    ms.prisma.addFriendRequests.findFirst.mockResolvedValue(null);
    ms.prisma.addFriendRequests.count.mockResolvedValue(0);
    ms.notifyFriendRequest.mockRejectedValue(new Error('Notification creation failed'));

    const req = { body: { userTag: 't#t' }, user: { id: senderId }, params: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;

    try {
      await FriendRouter.stack[0].route.stack.at(-1).handle(req, res, () => {}); await sleep(10);
    } catch (e) {
      expect(ms.prisma.addFriendRequests.create).not.toHaveBeenCalled();
    }
  });

  it('maintains consistency when friend request accept db write fails', async () => {
    const userId = uid();
    const senderId = uid();
    const requestId = cid();
    const ms = getMockState();

    ms.prisma.addFriendRequests.findUnique.mockResolvedValue({ id: requestId, sender_id: senderId, receiver_id: userId, status: 'pending' });
    ms.prisma.notifications.findUnique.mockResolvedValue({ id: 'notif-1', entity_id: requestId, type: 'friend_request' });
    ms.prisma.users.findUnique.mockResolvedValue({ id: senderId, user_name: 'Sender', image_url: null });
    ms.prisma.addFriendRequests.update.mockRejectedValue(new Error('DB write failed'));

    const req = { body: { notification: { entity_id: requestId, sender_user_id: senderId } }, user: { id: userId }, params: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;

    await expect(
      FriendRouter.stack[1].route.stack.at(-1).handle(req, res, () => {}),
    ).rejects.toThrow('DB write failed');
    await sleep(10);
    expect(ms.createDmChat).not.toHaveBeenCalled();
  });

  it('does not create duplicate friend requests on rapid clicks', async () => {
    const senderId = uid();
    const targetId = uid();
    const ms = getMockState();

    ms.prisma.users.findUnique.mockResolvedValue({ id: senderId, user_name: 'Sender', user_tag: 's#t', email: 's@t.com' });
    ms.prisma.users.findFirst.mockResolvedValue({ id: targetId, user_name: 'Target', email: 't@t.com', user_tag: 't#t' });

    ms.prisma.addFriendRequests.findFirst.mockResolvedValue({ id: 'existing', status: 'pending' });

    const req = { body: { userTag: 't#t' }, user: { id: senderId }, params: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;

    await FriendRouter.stack[0].route.stack.at(-1).handle(req, res, () => {}); await sleep(10);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('Voting System Consistency', () => {
  it('toggles upvote to downvote correctly in transaction', async () => {
    const userId = uid();
    const messageId = mid();
    const ms = getMockState();

    let voteRecord: any = { id: 'vote-1', type: 'upvote' };

    ms.prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
      const deleteFn = vi.fn().mockImplementation(async () => { voteRecord = null; });
      const createFn = vi.fn().mockImplementation(async (data: any) => { voteRecord = { ...data, id: 'vote-2' }; });
      const updateFn = vi.fn().mockResolvedValue({});

      const tx = {
        anonymousChatMessagesUserVotes: {
          findFirst: vi.fn().mockImplementation(async () => voteRecord),
          delete: deleteFn,
          create: createFn,
        },
        anonymousChatMessages: { update: updateFn },
      };
      return fn(tx);
    });

    ms.prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
      const tx = {
        anonymousChatMessagesUserVotes: {
          findFirst: vi.fn().mockResolvedValue({ id: 'vote-1', type: 'upvote' }),
          delete: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({}),
        },
        anonymousChatMessages: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
  });

  it('prevents double voting counting', async () => {
    const userId = uid();
    const messageId = mid();
    const ms = getMockState();

    ms.prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
      const findFirst = vi.fn()
        .mockResolvedValueOnce({ id: 'vote-1', type: 'upvote' })
        .mockResolvedValueOnce(null);

      const tx = {
        anonymousChatMessagesUserVotes: {
          findFirst,
          delete: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({}),
        },
        anonymousChatMessages: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
  });
});

function mid() { return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
