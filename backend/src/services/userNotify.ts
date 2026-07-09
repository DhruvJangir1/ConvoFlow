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

export async function notifyFriendRequest(
  receiverId: string,
  senderId: string,
  senderName: string,
  requestId: string,
): Promise<{ notification: Record<string, unknown>; friendRequest: Record<string, unknown> }> {
  console.log(`[notifyFriendRequest] Creating notification and friend request with entity_id=${requestId}`);

  try {
    const [notification, friendRequest] = await prisma.$transaction(async (tx) => {
      // friend req must be created FIRST because notif.entity_id has a FK to friendreq_id
      
      const req = await tx.addFriendRequests.create({
        data: {
          id: requestId,
          sender_id: senderId,
          receiver_id: receiverId,
          status: 'pending',
        },
      });
      const notif = await tx.notifications.create({
        data: {
          receiver_user_id: receiverId,
          sender_user_id: senderId,
          type: 'friend_request',
          content: `${senderName} sent you a friend request`,
          entity_id: requestId,
        },
      });
      return [notif, req];
    });

    sendToUser(receiverId, {
      type: 'notification:new',
      payload: notification,
    });

    console.log(`[notifyFriendRequest] Success: notification=${notification.id}, friendRequest=${friendRequest.id}`);
    return { notification, friendRequest };
  } catch (err) {
    console.error('[notifyFriendRequest] Error:', err);
    throw err;
  }
}
