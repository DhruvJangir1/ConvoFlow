import { prisma } from '../lib/connectionPoolClient.js';

export async function upvote(userId: string, messageId: string) {

  return prisma.$transaction(async (tx) => {
    const existing = await tx.anonymousChatMessagesUserVotes.findFirst({
      where: { user_id: userId, message_id: messageId },
    });
    if (existing) {
      if (existing.type === 'upvote') {
        await tx.anonymousChatMessagesUserVotes.delete({ where: { id: existing.id } });
        await tx.anonymousChatMessages.update({
          where: { id: messageId },
          data: { TotalUpvotes: { decrement: 1 } },
        });
        return { success: true, action: 'removed' };
      }

      await tx.anonymousChatMessagesUserVotes.delete({ where: { id: existing.id } });

      await tx.anonymousChatMessagesUserVotes.create({
        data: { user_id: userId, message_id: messageId, type: 'upvote' },
      });
      console.log('step 5')
      await tx.anonymousChatMessages.update({
        where: { id: messageId },
        data: { TotalUpvotes: { increment: 2 } },
      });

      return { success: true, action: 'added' };
    }
    await tx.anonymousChatMessagesUserVotes.create({
      data: { user_id: userId, message_id: messageId, type: 'upvote' },
    });
    await tx.anonymousChatMessages.update({
      where: { id: messageId },
      data: { TotalUpvotes: { increment: 1 } },
    });
    return { success: true, action: 'added' };
  });
}

export async function downvote(userId: string, messageId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.anonymousChatMessagesUserVotes.findFirst({
      where: { user_id: userId, message_id: messageId },
    });

    if (existing) {
      if (existing.type === 'downvote') {
        await tx.anonymousChatMessagesUserVotes.delete({ where: { id: existing.id } });
        await tx.anonymousChatMessages.update({
          where: { id: messageId },
          data: { TotalUpvotes: { increment: 1 } },
        });
        return { success: true, action: 'removed' };
      }

      await tx.anonymousChatMessagesUserVotes.delete({ where: { id: existing.id } });
      await tx.anonymousChatMessagesUserVotes.create({
        data: { user_id: userId, message_id: messageId, type: 'downvote' },
      });
      await tx.anonymousChatMessages.update({
        where: { id: messageId },
        data: { TotalUpvotes: { decrement: 2 } },
      });
      return { success: true, action: 'added' };
    }

    await tx.anonymousChatMessagesUserVotes.create({
      data: { user_id: userId, message_id: messageId, type: 'downvote' },
    });
    await tx.anonymousChatMessages.update({
      where: { id: messageId },
      data: { TotalUpvotes: { decrement: 1 } },
    });
    return { success: true, action: 'added' };
  });
}
