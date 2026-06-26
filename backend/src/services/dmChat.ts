import { prisma } from '../lib/connectionPoolClient.js';

export async function findDmChat(userIdA: string, userIdB: string) {
  const [membershipsA, membershipsB] = await Promise.all([
    prisma.chat_members.findMany({ where: { user_id: userIdA }, select: { chat_id: true } }),
    prisma.chat_members.findMany({ where: { user_id: userIdB }, select: { chat_id: true } }),
  ]);

  const chatIdsA = new Set(membershipsA.map(m => m.chat_id));
  const commonIds = membershipsB.map(m => m.chat_id).filter(id => chatIdsA.has(id));

  if (commonIds.length === 0) return null;

  const existing = await prisma.chats.findFirst({
    where: { id: { in: commonIds }, type: 'dm' },
    select: { id: true },
  });

  if (!existing) return null;

  return prisma.chats.findUnique({
    where: { id: existing.id },
    include: {
      chat_members: {
        include: {
          users: { select: { id: true, user_name: true, image_url: true } },
        },
      },
    },
  });
}

export async function createDmChat(userIdA: string, userIdB: string, creatorId: string) {
  console.log(`these are the people: userIDA ${userIdA}   useridB ${userIdB}  creatorId ${creatorId}`)
  const chat = await prisma.chats.create({
    data: { type: 'dm', created_by: creatorId },
  });
  console.log('this is chat,',chat)

const memberIds = [...new Set([userIdA, userIdB])];
await prisma.chat_members.createMany({
  data: memberIds.map(user_id => ({ chat_id: chat.id, user_id })),
});
  return prisma.chats.findUnique({
    where: { id: chat.id },
    include: {
      chat_members: {
        include: {
          users: { select: { id: true, user_name: true, image_url: true } },
        },
      },
    },
  });
}
