import { prisma } from '../lib/connectionPoolClient.js';

export async function upvote(userId: string, messageId: string) {
  console.log('step 1')
  return prisma.$transaction(async (tx) => {
    const existing = await tx.anonymousChatMessagesUserVotes.findFirst({
      where: { user_id: userId, mesage_id: messageId },
    });
console.log('step 2')
    if (existing) {
      if (existing.type === 'upvote') {
        await tx.anonymousChatMessagesUserVotes.delete({ where: { id: existing.id } });
        await tx.anonymousChatMessages.update({
          where: { id: messageId },
          data: { TotalUpvotes: { decrement: 1 } },
        });
        return { success: true, action: 'removed' };
      }
      console.log('step 3')

      await tx.anonymousChatMessagesUserVotes.delete({ where: { id: existing.id } });

      console.log('step 4')
      await tx.anonymousChatMessagesUserVotes.create({
        data: { user_id: userId, mesage_id: messageId, type: 'upvote' },
      });
      console.log('step 5')
      await tx.anonymousChatMessages.update({
        where: { id: messageId },
        data: { TotalUpvotes: { increment: 2 } },
      });

      console.log('step 6')
      return { success: true, action: 'added' };
    }
    console.log('step 7')
    await tx.anonymousChatMessagesUserVotes.create({
      data: { user_id: userId, mesage_id: messageId, type: 'upvote' },
    });
    console.log('step 8')
    await tx.anonymousChatMessages.update({
      where: { id: messageId },
      data: { TotalUpvotes: { increment: 1 } },
    });
    console.log('step 9')
    return { success: true, action: 'added' };
  });
}

export async function downvote(userId: string, messageId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.anonymousChatMessagesUserVotes.findFirst({
      where: { user_id: userId, mesage_id: messageId },
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
        data: { user_id: userId, mesage_id: messageId, type: 'downvote' },
      });
      await tx.anonymousChatMessages.update({
        where: { id: messageId },
        data: { TotalUpvotes: { decrement: 2 } },
      });
      return { success: true, action: 'added' };
    }

    await tx.anonymousChatMessagesUserVotes.create({
      data: { user_id: userId, mesage_id: messageId, type: 'downvote' },
    });
    await tx.anonymousChatMessages.update({
      where: { id: messageId },
      data: { TotalUpvotes: { decrement: 1 } },
    });
    return { success: true, action: 'added' };
  });
}
