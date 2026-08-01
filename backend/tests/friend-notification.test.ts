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
  get signImageUrl() { const s = (globalThis as any).__testMockState; return s ? s.imageUpload.signImageUrl : vi.fn(); },
}));
vi.mock('../src/services/dmChat.js', () => ({
  get createDmChat() { const s = (globalThis as any).__testMockState; return s ? s.createDmChat : vi.fn(); },
  get findDmChat() { const s = (globalThis as any).__testMockState; return s ? vi.fn() : vi.fn(); },
}));

const wsMockFns = vi.hoisted(() => ({
  sendToUser: vi.fn(),
  broadcastToRoom: vi.fn(),
  broadcastMessageToRoom: vi.fn(),
}));
vi.mock('../ws/websocket.js', () => wsMockFns);

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

let FriendRouter: any;

beforeEach(async () => {
  vi.clearAllMocks();
  (globalThis as Record<string, unknown>).__testMockState = createFreshMockState();
  setupDefaultMocks();

  const mod = await import('../src/routes/userAddFriend');
  FriendRouter = mod.default;
});

afterEach(() => {
  resetMockState();
});

function createReq(body: any, user?: { id: string }, params?: any, method = 'POST') {
  return {
    body,
    user,
    params: params || {},
    query: {},
    method,
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as any;
}

function createRes() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

async function callHandler(router: any, stackIdx: number, req: any, res: any) {
  const handler = router.stack[stackIdx].route.stack.at(-1).handle;
  await handler(req, res, () => {});
  await sleep(5);
}

/* ═══════════════════════════════════════════════════════════════════════
   7. FRIEND REQUEST SYSTEM
   ═══════════════════════════════════════════════════════════════════════ */

describe('Friend Request System', () => {
  describe('Sending friend requests', () => {
    it('sends friend request successfully', async () => {
      const senderId = uid();
      const targetId = uid();
      const ms = getMockState();

      ms.prisma.users.findUnique.mockResolvedValue({ id: senderId, user_name: 'Sender', user_tag: 'sender#1234', email: 'sender@test.com' });
      ms.prisma.users.findFirst.mockResolvedValue({ id: targetId, user_name: 'Target', email: 'target@test.com', user_tag: 'target#5678' });
      ms.prisma.addFriendRequests.findFirst.mockResolvedValue(null);
      ms.prisma.addFriendRequests.count.mockResolvedValue(0);
      ms.notifyFriendRequest.mockResolvedValue({ friendRequest: { id: 'fr-1', status: 'pending' } });

      const req = createReq({ userTag: 'target#5678' }, { id: senderId });
      const res = createRes();

      await callHandler(FriendRouter, 0, req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it('rejects friend request to self', async () => {
      const userId = uid();
      const ms = getMockState();

      ms.prisma.users.findUnique.mockResolvedValue({ id: userId, user_name: 'User', user_tag: 'user#tag', email: 'user@test.com' });
      ms.prisma.users.findFirst.mockResolvedValue({ id: userId, user_name: 'User', email: 'user@test.com', user_tag: 'user#tag' });

      const req = createReq({ userTag: 'user#tag' }, { id: userId });
      const res = createRes();

      await callHandler(FriendRouter, 0, req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects duplicate pending friend request', async () => {
      const senderId = uid();
      const targetId = uid();
      const ms = getMockState();

      ms.prisma.users.findUnique.mockResolvedValue({ id: senderId, user_name: 'Sender', user_tag: 'sender#tag', email: 's@t.com' });
      ms.prisma.users.findFirst.mockResolvedValue({ id: targetId, user_name: 'Target', email: 't@t.com', user_tag: 'target#tag' });
      ms.prisma.addFriendRequests.findFirst.mockResolvedValue({ id: 'existing', status: 'pending' });

      const req = createReq({ userTag: 'target#tag' }, { id: senderId });
      const res = createRes();

      await callHandler(FriendRouter, 0, req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('rejects request when target user does not exist', async () => {
      const senderId = uid();
      const ms = getMockState();

      ms.prisma.users.findUnique.mockResolvedValue({ id: senderId, user_name: 'Sender', user_tag: 's#t', email: 's@t.com' });
      ms.prisma.users.findFirst.mockResolvedValue(null);

      const req = createReq({ userTag: 'nonexistent#tag' }, { id: senderId });
      const res = createRes();

      await callHandler(FriendRouter, 0, req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects request when previously rejected by target', async () => {
      const senderId = uid();
      const targetId = uid();
      const ms = getMockState();

      ms.prisma.users.findUnique.mockResolvedValue({ id: senderId, user_name: 'Sender', user_tag: 's#t', email: 's@t.com' });
      ms.prisma.users.findFirst.mockResolvedValue({ id: targetId, user_name: 'Target', email: 't@t.com', user_tag: 't#t' });
      ms.prisma.addFriendRequests.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'rejected', status: 'rejected' });

      const req = createReq({ userTag: 't#t' }, { id: senderId });
      const res = createRes();

      await callHandler(FriendRouter, 0, req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('rejects request when max pending outgoing reached', async () => {
      const senderId = uid();
      const targetId = uid();
      const ms = getMockState();

      ms.prisma.users.findUnique.mockResolvedValue({ id: senderId, user_name: 'Sender', user_tag: 's#t', email: 's@t.com' });
      ms.prisma.users.findFirst.mockResolvedValue({ id: targetId, user_name: 'Target', email: 't@t.com', user_tag: 't#t' });
      ms.prisma.addFriendRequests.count.mockResolvedValue(10);

      const req = createReq({ userTag: 't#t' }, { id: senderId });
      const res = createRes();

      await callHandler(FriendRouter, 0, req, res);

      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Accepting friend requests', () => {
    it('accepts friend request and creates DM chat', async () => {
      const userId = uid();
      const senderId = uid();
      const requestId = cid();
      const chatId = cid();
      const ms = getMockState();

      ms.prisma.addFriendRequests.findUnique.mockResolvedValue({ id: requestId, sender_id: senderId, receiver_id: userId, status: 'pending' });
      ms.prisma.notifications.findUnique.mockResolvedValue({ id: 'notif-1', entity_id: requestId, type: 'friend_request' });
      ms.prisma.users.findUnique.mockResolvedValue({ id: senderId, user_name: 'Sender', image_url: null });
      ms.prisma.notifications.create.mockResolvedValue({ id: 'notif-accept', receiver_user_id: senderId, type: 'friend_request_accepted', content: 'Accepted', entity_id: chatId });
      ms.imageUpload.resolveImageUrl.mockResolvedValue('https://signed.url/image.png');
      ms.createDmChat.mockResolvedValue({
        id: chatId,
        type: 'dm',
        StandardChatMembers: [
          { user_id: userId, USERS: { id: userId, user_name: 'Me', image_url: null } },
          { user_id: senderId, USERS: { id: senderId, user_name: 'Sender', image_url: null } },
        ],
      });

      const req = createReq(
        { notification: { entity_id: requestId, sender_user_id: senderId } },
        { id: userId }, undefined, 'PATCH',
      );
      const res = createRes();

      await callHandler(FriendRouter, 1, req, res);

      expect(ms.prisma.addFriendRequests.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: requestId }, data: expect.objectContaining({ status: 'accepted' }) }),
      );
      expect(ms.createDmChat).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('rejects acceptance when user is not the receiver', async () => {
      const userId = uid();
      const senderId = uid();
      const requestId = cid();
      const ms = getMockState();

      ms.prisma.addFriendRequests.findUnique.mockResolvedValue({ id: requestId, sender_id: senderId, receiver_id: uid(), status: 'pending' });

      const req = createReq(
        { notification: { entity_id: requestId, sender_user_id: senderId } },
        { id: userId }, undefined, 'PATCH',
      );
      const res = createRes();

      await callHandler(FriendRouter, 1, req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('rejects acceptance when request is not pending', async () => {
      const userId = uid();
      const senderId = uid();
      const requestId = cid();
      const ms = getMockState();

      ms.prisma.addFriendRequests.findUnique.mockResolvedValue({ id: requestId, sender_id: senderId, receiver_id: userId, status: 'accepted' });

      const req = createReq(
        { notification: { entity_id: requestId, sender_user_id: senderId } },
        { id: userId }, undefined, 'PATCH',
      );
      const res = createRes();

      await callHandler(FriendRouter, 1, req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('handles missing request gracefully', async () => {
      const userId = uid();
      const senderId = uid();
      const ms = getMockState();

      ms.prisma.addFriendRequests.findUnique.mockResolvedValue(null);

      const req = createReq(
        { notification: { entity_id: 'nonexistent', sender_user_id: senderId } },
        { id: userId }, undefined, 'PATCH',
      );
      const res = createRes();

      await callHandler(FriendRouter, 1, req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('Rejecting friend requests', () => {
    it('rejects friend request and sends notification', async () => {
      const userId = uid();
      const senderId = uid();
      const requestId = cid();
      const ms = getMockState();

      ms.prisma.addFriendRequests.findUnique.mockResolvedValue({
        id: requestId,
        sender_id: senderId,
        receiver_id: userId,
        status: 'pending',
        USERS_AddFriendRequests_receiver_idToUSERS: { user_name: 'Rejector' },
        USERS_AddFriendRequests_sender_idToUSERS: { id: senderId },
      });
      ms.prisma.notifications.findUnique.mockResolvedValue({ id: 'notif-orig', entity_id: requestId });
      ms.prisma.notifications.create.mockResolvedValue({ id: 'notif-reject', receiver_user_id: senderId, type: 'friend_request_rejected', content: 'Rejected', entity_id: cid() });

      const req = createReq({}, { id: userId }, { id: requestId }, 'PATCH');
      const res = createRes();

      await callHandler(FriendRouter, 2, req, res);

      expect(ms.prisma.addFriendRequests.delete).toHaveBeenCalledWith({ where: { id: requestId } });
      expect(ms.prisma.notifications.create).toHaveBeenCalled();
      expect(wsMockFns.sendToUser).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('rejects rejection when user is not receiver', async () => {
      const userId = uid();
      const requestId = cid();
      const ms = getMockState();

      ms.prisma.addFriendRequests.findUnique.mockResolvedValue({
        id: requestId,
        sender_id: uid(),
        receiver_id: uid(),
        status: 'pending',
        USERS_AddFriendRequests_receiver_idToUSERS: { user_name: 'Other' },
        USERS_AddFriendRequests_sender_idToUSERS: { id: uid() },
      });

      const req = createReq({}, { id: userId }, { id: requestId }, 'PATCH');
      const res = createRes();

      await callHandler(FriendRouter, 2, req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════
    8. NOTIFICATION SYSTEM
   ═══════════════════════════════════════════════════════════════════════ */

describe('Notification System', () => {
  let NotificationRouter: any;

  beforeEach(async () => {
    const mod = await import('../src/routes/userNotification');
    NotificationRouter = mod.default;
  });

  it('fetches user notifications', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.prisma.notifications.findMany.mockResolvedValue([
      { id: 'n1', type: 'friend_request', content: 'Friend request', read_at: null },
      { id: 'n2', type: 'friend_request_accepted', content: 'Accepted', read_at: new Date().toISOString() },
    ]);

    const req = createReq({}, { id: userId }, undefined, 'GET');
    const res = createRes();

    await callHandler(NotificationRouter, 0, req, res);

    expect(ms.prisma.notifications.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { receiver_user_id: userId }, orderBy: { created_at: 'desc' }, take: 50 }),
    );
    expect(res.json).toHaveBeenCalled();
  });

  it('filters unread notifications', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.prisma.notifications.findMany.mockResolvedValue([
      { id: 'n1', type: 'friend_request', read_at: null },
    ]);

    const req = createReq({}, { id: userId }, {}, 'GET');
    req.query = { unread: 'true' };

    const res = createRes();

    await callHandler(NotificationRouter, 0, req, res);

    expect(ms.prisma.notifications.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { receiver_user_id: userId, read_at: null } }),
    );
  });

  it('marks single notification as read', async () => {
    const userId = uid();
    const notifId = cid();
    const ms = getMockState();

    ms.prisma.notifications.findUnique.mockResolvedValue({ id: notifId, receiver_user_id: userId, read_at: null });

    const req = createReq({}, { id: userId }, { id: notifId }, 'PATCH');
    const res = createRes();

    await callHandler(NotificationRouter, 1, req, res);

    expect(ms.prisma.notifications.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: notifId }, data: { read_at: expect.any(Date) } }),
    );
  });

  it('rejects marking another users notification as read', async () => {
    const userId = uid();
    const notifId = cid();
    const ms = getMockState();

    ms.prisma.notifications.findUnique.mockResolvedValue({ id: notifId, receiver_user_id: uid(), read_at: null });

    const req = createReq({}, { id: userId }, { id: notifId }, 'PATCH');
    const res = createRes();

    await callHandler(NotificationRouter, 1, req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('marks all notifications as read', async () => {
    const userId = uid();
    const ms = getMockState();

    const req = createReq({}, { id: userId }, undefined, 'PATCH');
    const res = createRes();

    await NotificationRouter.stack[2].handle(req, res, () => {});

    expect(ms.prisma.notifications.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { receiver_user_id: userId, read_at: null } }),
    );
  });

  it('returns empty array when no notifications', async () => {
    const userId = uid();
    const ms = getMockState();
    ms.prisma.notifications.findMany.mockResolvedValue([]);

    const req = createReq({}, { id: userId }, undefined, 'GET');
    const res = createRes();

    await callHandler(NotificationRouter, 0, req, res);

    expect(res.json).toHaveBeenCalledWith({ notifications: [] });
  });
});
