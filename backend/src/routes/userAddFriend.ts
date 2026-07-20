import crypto from 'crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/connectionPoolClient.js';
import { sendFriendRequestEmail } from '../services/authVerificaiton.js';
import { notifyFriendRequest } from '../services/userNotify.js';
import { sendToUser } from '../../ws/websocket.js';
import { resolveImageUrl } from '../services/imageUpload.js';
import { FRIEND_MAX_PENDING_OUTGOING } from '../util/constants.js';
import { createDmChat } from '../services/dmChat.js';
import type { Notifications } from '../../../src/generated/prisma/client.js';

const FriendRouter = Router();

FriendRouter.post('/send', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user){
    return;
  }

  const { userTag } = req.body;
  const senderId = req.user.id;
  console.log(`[FriendRoute] POST /api/friends/send — sender: ${senderId}, target tag: ${userTag}`);

  if (!userTag || typeof userTag !== 'string' || !userTag.trim()) {
    console.log('[FriendRoute] 400 — userTag is required');
    res.status(400).json({ error: 'userTag is required' });
    return;
  }

  const trimmedTag = userTag.trim();
  
  const senderUser = await prisma.users.findUnique({
      where: { id: senderId },
      select: { user_name: true, user_tag: true, email: true },
    })
    
    if (!senderUser){
      return;
    }

  const targetUser = await prisma.users.findFirst({
      where: { user_tag: trimmedTag },
      select: { id: true, user_name: true, email: true, user_tag: true },
    })

  if (!targetUser) {
    console.log(`[FriendRoute] 404 — target user not found for tag: ${trimmedTag}`);
    res.status(404).json({ error: 'User not found' });
    return;
  }
  console.log(`[FriendRoute] Target found: ${targetUser.user_name} (${targetUser.id})`);

  if (targetUser.id === senderId) {
    console.log('[FriendRoute] 400 — self-request blocked');
    res.status(400).json({ error: 'You cannot send a friend request to yourself' });
    return;
  }

  const existingRequest = await prisma.addFriendRequests.findFirst({
    where: {
      OR: [
        { sender_id: senderId, receiver_id: targetUser.id },
        { sender_id: targetUser.id, receiver_id: senderId },
      ],
      status: 'pending'
    },
  });

  if (existingRequest) {
    console.log(`[FriendRoute] 409 — duplicate pending request (${existingRequest.id})`);
    res.status(409).json({ error: 'A pending friend request already exists between you and this user' });
    return;
  }

  const pendingOutgoingCount = await prisma.addFriendRequests.count({
    where: { sender_id: senderId, receiver_id:targetUser.id, status: 'pending' },
  });

  if (pendingOutgoingCount >= FRIEND_MAX_PENDING_OUTGOING) {
    console.log(`[FriendRoute] 429 — sender at max pending (${pendingOutgoingCount})`);
    res.status(429).json({ error: `You can only have up to ${FRIEND_MAX_PENDING_OUTGOING} pending friend requests` });
    return;
  }

  // permanently block re-sending after a rejection
  const previouslyRejected = await prisma.addFriendRequests.findFirst({
    where: {
      sender_id: senderId,
      receiver_id: targetUser.id,
      status: 'rejected',
    },
  });

  if (previouslyRejected) {
    console.log(`[FriendRoute] 403 — sender was previously rejected by ${targetUser.user_name}`);
    res.status(403).json({ error: 'This user has declined your friend request' });
    return;
  }

  const requestId = crypto.randomUUID();
  console.log(`[FriendRoute] Generated request UUID: ${requestId}`);

  // entity_id is now @unique with a FK from AddFriendRequests.id,
  // so the notification must be created before the friend request
  const { friendRequest } = await notifyFriendRequest(
    targetUser.id,
    senderId,
    senderUser.user_name,
    requestId,
  );
  console.log(`[FriendRoute] Friend request created: ${friendRequest.id} (pending) and notification sent`);

  await sendFriendRequestEmail(senderUser.user_name, senderUser.user_tag, targetUser.email);
  console.log(`[FriendRoute] Email sent to ${targetUser.email}`);

  res.status(201).json({
    message: 'Friend request sent',
    request: { id: friendRequest.id, status: friendRequest.status },
  });
  console.log('[FriendRoute] 201 — success response sent');
});

FriendRouter.patch('/accept', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const userId = req.user.id;
  const notification = req.body.notification as Notifications;
  console.log(notification)
  const requestId = notification.entity_id;
  const senderId = notification.sender_user_id;

  console.log('this is notification',notification)
  console.log(`[FriendRoute] PATCH /api/friends/${requestId}/accept — receiver: ${userId}, sender: ${senderId}`);
  console.log('[friend route] this is requestId',requestId)


  if (!requestId || !senderId) {
    console.log('[FriendRoute] 400 — entity_id or sender_user_id missing');
    res.status(400).json({ error: 'entity_id and sender_user_id are required' });
    return;
  }

  const friendRequest = await prisma.addFriendRequests.findUnique({ where: { id: requestId } });

  if (!friendRequest) {
    console.log(`[FriendRoute] 404 — friend request ${requestId} not found`);
    res.status(404).json({ error: 'Friend request not found' });
    return;
  }
  console.log(`[FriendRoute] Found request: status=${friendRequest.status}, receiver=${friendRequest.receiver_id}`);

  if (friendRequest.receiver_id !== userId) {
    console.log(`[FriendRoute] 403 — user ${userId} is not the receiver (receiver=${friendRequest.receiver_id})`);
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  if (friendRequest.status !== 'pending') {
    console.log(`[FriendRoute] 400 — request status is "${friendRequest.status}", expected "pending"`);
    res.status(400).json({ error: 'Friend request is not pending' });
    return;
  }

  await prisma.addFriendRequests.update({
    where: { id: requestId },
    data: { status: 'accepted', updated_at: new Date() },
  });

  const notif = await prisma.notifications.findUnique({
    where: { entity_id: requestId },
  });
  if (notif && notif.type === 'friend_request') {
    console.log('[FriendRoute] Found original friend_request notification, updating to accepted');
    await prisma.notifications.update({
      where: { id: notif.id },
      data: { type: 'friend_request_accepted', read_at: new Date() },
    });
  }

  console.log(`[FriendRoute] Request ${requestId} updated to "accepted"`);

  const senderUser = await prisma.users.findUnique({
    where: { id: senderId },
    select: { user_name: true, image_url: true },
  });
  
  if (!senderUser) {
    console.log(`[FriendRoute] 404 — sender user ${senderId} not found`);
    res.status(404).json({ error: 'Sender user not found' });
    return;
  }

  const chat = await createDmChat(senderId, userId, userId, senderUser.user_name, senderUser.image_url || '');
  if (!chat){
    console.log('[FriendRoute] 500 — createDmChat returned null');
    res.status(500).json({ error: 'Failed to create chat' });
    return;
  }
  const chatId = chat.id;
  console.log(`[FriendRoute] DM chat created: ${chatId}`);

  
  let otherMember = chat.StandardChatMembers.find(m => m.user_id !== userId);
  const myMember = chat.StandardChatMembers.find(m => m.user_id === userId);

  if ( userId === senderId){
    console.log('[FriendRoute] Warning: userId and senderId are the same, which should not happen in a friend request acceptance');
    otherMember = myMember; 
  }
  // if they are the same users

  if (!otherMember || !myMember){
    if (!otherMember){
      console.log('[FriendRoute] Warning: otherMember not found in chat_members');
    }
    if (!myMember){
      console.log('[FriendRoute] Warning: myMember not found in chat_members');
    }
    console.log('[FriendRoute] Sending 500 — chat member data missing, returning error to client');
    res.status(500).json({ error: 'Chat member data missing' });
    return;
  }
  
    console.log('[userAddFriend/accept] othermember and my member exists')
    const acceptedNotification = await prisma.notifications.create({
      data: {
        receiver_user_id: senderId,
        sender_user_id: userId,
        type: 'friend_request_accepted',
        content: `${myMember?.USERS.user_name ?? 'Someone'} accepted your friend request`,
        entity_id: chatId
      },
    });
    console.log(`[FriendRoute] Accepted notification created: ${acceptedNotification.id}`);

    sendToUser(senderId, {
      type: 'notification:new',
      payload: acceptedNotification,
    });
    console.log(`[FriendRoute] WebSocket "notification:new" sent to sender ${senderId}`);

    const now = Date.now();

    //NOTE: these 2 prisma queries dont add any messages but they show the chat in the user's UI for UX.

    const signedMyImage = await resolveImageUrl(myMember.USERS.image_url);
    const signedOtherImage = await resolveImageUrl(otherMember.USERS.image_url);

    // the guy who sent the request
    sendToUser(senderId, {
      type: 'chat:new',
      payload: {
        chat: {
          id: chatId,
          name: myMember.USERS.user_name ?? 'Unknown',
          avatar_url: signedMyImage,
          lastMessage: '',
          timestamp: now,
          unread: 0,
          type: 'dm',
          messageCount: 0,
          members: [{ id: userId, user_name: myMember.USERS.user_name ?? 'Unknown', image_url: signedMyImage }],
        },
      },
    });
    console.log(`[FriendRoute] WebSocket "chat:new" sent to sender ${senderId}`);

    // the guy accpting request
    sendToUser(userId, {
      type: 'chat:new',
      payload: {
        chat: {
          id: chatId,
          name: otherMember.USERS.user_name,
          avatar_url: signedOtherImage,
          lastMessage: '',
          timestamp: now,
          unread: 0,
          type: 'dm',
          messageCount: 0,
          members: [{ id: senderId, user_name: otherMember.USERS.user_name, image_url: signedOtherImage }],
        },
      },
    });
    console.log(`[FriendRoute] WebSocket "chat:new" sent to receiver ${userId}`);

  res.json({
    success: true,
    chat: {
      id: chatId,
      name: otherMember.USERS.user_name,
      avatar_url: signedOtherImage,
      messageCount: 0,
    },
    senderName: otherMember.USERS.user_name,
  });
  console.log(`[FriendRoute] 200 — accepted, chat=${chatId}`);
});

FriendRouter.patch('/:id/reject', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user){
    console.log('[userAddFriend/id/reject] No User Found!')
    return;
  }

  const userId = req.user.id;
  const id = req.params.id as string;
  console.log(`[FriendRoute] PATCH /api/friends/${id}/reject — user: ${userId}`);

  const friendRequest = await prisma.addFriendRequests.findUnique({
    where: { id },
    include: {
      USERS_AddFriendRequests_receiver_idToUSERS: { select: { user_name: true } },
      USERS_AddFriendRequests_sender_idToUSERS: { select: { id: true } },
    },
  });
  if (!friendRequest) {
    res.status(404).json({ error: 'Friend request not found' });
    return;
  }

  if (friendRequest.receiver_id !== userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  if (friendRequest.status !== 'pending') {
    res.status(400).json({ error: 'Friend request is not pending' });
    return;
  }

  const rejectorName = friendRequest.USERS_AddFriendRequests_receiver_idToUSERS.user_name ?? 'Someone';

  await prisma.addFriendRequests.delete({ where: { id } });

  const originalNotification = await prisma.notifications.findUnique({
    where: { entity_id: id },
  });
  if (originalNotification) {
    await prisma.notifications.delete({ where: { id: originalNotification.id } });
  }
  console.log(`[FriendRoute] Friend request ${id} deleted`);

  const rejectedNotification = await prisma.notifications.create({
    data: {
      receiver_user_id: friendRequest.sender_id,
      sender_user_id: userId,
      type: 'friend_request_rejected',
      content: `${rejectorName} rejected your friend request`,
      entity_id: crypto.randomUUID(),
    },
  });
  console.log(`[FriendRoute] Rejected notification created: ${rejectedNotification.id}`);

  sendToUser(friendRequest.sender_id, {
    type: 'notification:new',
    payload: rejectedNotification,
  });
  console.log(`[FriendRoute] WebSocket "notification:new" sent to sender ${friendRequest.sender_id}`);

  res.json({ success: true });
});

export default FriendRouter;
