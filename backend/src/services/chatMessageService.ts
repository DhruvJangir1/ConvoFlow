import { prisma } from '../lib/connectionPoolClient.js';

export interface InsertedMessage {
  id: string;
  createdAt: Date;
}

export async function insertStandardChatMessage(
  messageId: string,
  chatId: string,
  senderId: string,
  content: string,
): Promise<InsertedMessage> {
  const rows = await prisma.$queryRaw<InsertedMessage[]>`
    INSERT INTO "StandardChatMessages" ("id", "chat_id", "sender_id", "content")
    VALUES (${messageId}::uuid, ${chatId}::uuid, ${senderId}::uuid, ${content})
    RETURNING "id", "created_at" AS "createdAt"
  `;
  return rows[0];
}

export async function requireChatMembership(
  userId: string,
  chatId: string,
): Promise<boolean> {
  const membership = await prisma.standardChatMembers.findUnique({
    where: { chat_id_user_id: { chat_id: chatId, user_id: userId } },
    select: { user_id: true },
  });
  return membership !== null;
}
