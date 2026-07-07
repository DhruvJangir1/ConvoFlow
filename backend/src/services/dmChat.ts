import { prisma } from '../lib/connectionPoolClient.js';

export async function findDmChat(userIdA: string, userIdB: string) {
  const [membershipsA, membershipsB] = await Promise.all([
    prisma.standardChatMembers.findMany({ where: { user_id: userIdA }, select: { chat_id: true } }),
    prisma.standardChatMembers.findMany({ where: { user_id: userIdB }, select: { chat_id: true } }),
  ]);

  const chatIdsA = new Set(membershipsA.map(m => m.chat_id));
  const commonIds = membershipsB.map(m => m.chat_id).filter(id => chatIdsA.has(id));

  if (commonIds.length === 0) return null;

  const existing = await prisma.standardChats.findFirst({
    where: { id: { in: commonIds }, type: 'dm' },
    select: { id: true },
  });

  if (!existing) return null;

  return prisma.standardChats.findUnique({
    where: { id: existing.id },
    include: {
      StandardChatMembers: {
        include: {
          USERS: { select: { id: true, user_name: true, image_url: true } },
        },
      },
    },
  });
}

export async function createDmChat(userIdA: string, userIdB: string, creatorId: string, name?: string, avatar_url?: string) {
  console.log(`these are the people: userIDA ${userIdA}   useridB ${userIdB}  creatorId ${creatorId}`)
  const chat = await prisma.standardChats.create({
    data: { type: 'dm', created_by: creatorId, name, avatar_url },
  });
  console.log('this is chat,',chat)

const memberIds = [...new Set([userIdA, userIdB])];
await prisma.standardChatMembers.createMany({
  data: memberIds.map(user_id => ({ chat_id: chat.id, user_id })),
});
  return prisma.standardChats.findUnique({
    where: { id: chat.id },
    include: {
      StandardChatMembers: {
        include: {
          USERS: { select: { id: true, user_name: true, image_url: true } },
        },
      },
    },
  });
}
