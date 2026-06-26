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

export async function notifyFriendRequest(receiverId: string, senderId: string, senderName: string, friendRequestId: string): Promise<void> {
  try {
    const notification = await createNotification({
      receiver_user_id: receiverId,
      sender_user_id: senderId,
      type: 'friend_request',
      content: `${senderName} sent you a friend request`,
      entity_id: friendRequestId,
    });

    sendToUser(receiverId, {
      type: 'notification:new',
      payload: notification,
    });
  } catch (err) {
    console.error('[notifyFriendRequest] Error:', err);
  }
}
