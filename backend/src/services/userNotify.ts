import { prisma } from '../lib/connectionPoolClient.js';
import { sendToUser } from '../../ws/websocket.js';

export async function createNotification(data: {
  receiver_user_id: string;
  sender_user_id: string;
  type: string;
  content?: string;
  entity_id: string;
}) {
  return prisma.notifications.create({ data });
}

export async function deleteNotification(userId: string, notificationId: string) {
  const notification = await prisma.notifications.findFirst({
    where: { id: notificationId, receiver_user_id: userId },
    select: { type: true, entity_id: true },
  });

  if (!notification) return { count: 0 };

  if (notification.type.startsWith('friend_request')) {
    await prisma.addFriendRequests.deleteMany({
      where: { id: notification.entity_id },
    });
  }

  return prisma.notifications.deleteMany({
    where: { id: notificationId, receiver_user_id: userId },
  });
}

export async function deleteAllNotifications(userId: string) {
  const notifications = await prisma.notifications.findMany({
    where: { receiver_user_id: userId },
    select: { type: true, entity_id: true },
  });

  const friendRequestEntityIds = notifications
    .filter((n) => n.type.startsWith('friend_request'))
    .map((n) => n.entity_id);

  if (friendRequestEntityIds.length > 0) {
    await prisma.addFriendRequests.deleteMany({
      where: { id: { in: friendRequestEntityIds } },
    });
  }

  return prisma.notifications.deleteMany({ where: { receiver_user_id: userId } });
}

export async function notifyFriendRequest(
  receiverId: string,
  senderId: string,
  senderName: string,
  requestId: string,
): Promise<{ notification: Record<string, unknown>; friendRequest: Record<string, unknown> }> {
  console.log(`[notifyFriendRequest] Creating notification and friend request with entity_id=${requestId}`);

  try {
    const [notification, friendRequest] = await prisma.$transaction(async (tx) => {
      // Notification must be created FIRST because AddFriendRequests.id FKs to Notifications.entity_id
      
      const notif = await tx.notifications.create({
        data: {
          receiver_user_id: receiverId,
          sender_user_id: senderId,
          type: 'friend_request',
          content: `${senderName} sent you a friend request`,
          entity_id: requestId,
        },
      });
      const req = await tx.addFriendRequests.create({
        data: {
          id: requestId,
          sender_id: senderId,
          receiver_id: receiverId,
          status: 'pending',
        },
      });
      return [notif, req];
    });

    console.log(`[notifyFriendRequest] Success: notification=${notification.id}, friendRequest=${friendRequest.id}`);

    sendToUser(receiverId, {
      type: 'notification:new',
      payload: {
        id: notification.id,
        receiver_user_id: receiverId,
        sender_user_id: senderId,
        type: 'friend_request',
        content: `${senderName} sent you a friend request`,
        entity_id: requestId,
        read_at: null,
        created_at: new Date().toISOString(),
      },
    });

    return { notification, friendRequest };
  } catch (err) {
    console.error('[notifyFriendRequest] Error:', err);
    throw err;
  }
}
