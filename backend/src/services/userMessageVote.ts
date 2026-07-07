import { prisma } from '../lib/connectionPoolClient.js';

export async function upvote(userId: string, messageId: string) {
  const upvoteRecord = await prisma.anonymousChatMessagesUserVotes.findFirst({
    where: { user_id: userId, mesage_id: messageId, type: 'upvote' },
  });

  if (upvoteRecord) {
    await prisma.anonymousChatMessagesUserVotes.delete({
      where: { id: upvoteRecord.id },
    });

    await prisma.anonymousChatMessages.update({
      where: { id: messageId },
      data: { TotalUpvotes: { decrement: 1 } },
    });

    return { success: true, action: 'removed' };
  }

  const downvoteRecord = await prisma.anonymousChatMessagesUserVotes.findFirst({
    where: { user_id: userId, mesage_id: messageId, type: 'downvote' },
  });

  if (downvoteRecord) {
    await prisma.anonymousChatMessagesUserVotes.delete({
      where: { id: downvoteRecord.id },
    });

    await prisma.anonymousChatMessages.update({
      where: { id: messageId },
      data: { TotalUpvotes: { increment: 1 } },
    });
  }

  await prisma.anonymousChatMessagesUserVotes.create({
    data: {
      user_id: userId,
      mesage_id: messageId,
      type: 'upvote',
    },
  });

  await prisma.anonymousChatMessages.update({
    where: { id: messageId },
    data: { TotalUpvotes: { increment: 1 } },
  });

  return { success: true, action: 'added' };
}


export async function downvote(userId: string, messageId: string) {
  const downvoteRecord = await prisma.anonymousChatMessagesUserVotes.findFirst({
    where: { user_id: userId, mesage_id: messageId, type: 'downvote' },
  });

  if (downvoteRecord) {
    await prisma.anonymousChatMessagesUserVotes.delete({
      where: { id: downvoteRecord.id },
    });

    await prisma.anonymousChatMessages.update({
      where: { id: messageId },
      data: { TotalUpvotes: { increment: 1 } },
    });

    return { success: true, action: 'removed' };
  }

  const upvoteRecord = await prisma.anonymousChatMessagesUserVotes.findFirst({
    where: { user_id: userId, mesage_id: messageId, type: 'upvote' },
  });

  if (upvoteRecord) {
    await prisma.anonymousChatMessagesUserVotes.delete({
      where: { id: upvoteRecord.id },
    });

    await prisma.anonymousChatMessages.update({
      where: { id: messageId },
      data: { TotalUpvotes: { decrement: 1 } },
    });
  }

  const message = await prisma.anonymousChatMessages.findUnique({
    where: { id: messageId },
    select: { TotalUpvotes: true },
  });

  await prisma.anonymousChatMessagesUserVotes.create({
    data: {
      user_id: userId,
      mesage_id: messageId,
      type: 'downvote',
    },
  });

  if (message && message.TotalUpvotes > 0) {
    await prisma.anonymousChatMessages.update({
      where: { id: messageId },
      data: { TotalUpvotes: { decrement: 1 } },
    });
  }

  return { success: true, action: 'added' };
}
