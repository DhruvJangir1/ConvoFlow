import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { refreshUserAccessToken } from '../services/auth.js';
import { prisma } from '../lib/connectionPoolClient.js';
import { broadcastToRoom } from '../../ws/websocket.js';
import { findDmChat, createDmChat } from '../services/dmChat.js';

const ChatRouter = Router();

ChatRouter.post('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { participantIds, name } = req.body as { participantIds?: string[]; name?: string };

  if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    res.status(400).json({ error: 'participantIds must be a non-empty array' });
    return;
  }

  const allParticipantIds = [...new Set([userId, ...participantIds])];

  try {
    let chat: {
      id: string;
      type: string;
      name: string | null;
      created_by: string | null;
      avatar_url: string | null;
      created_at: Date;
      updated_at: Date;
      StandardChatMembers: {
        user_id: string;
        USERS: { id: string; user_name: string; image_url: string | null };
      }[];
    };

    if (allParticipantIds.length === 2) {
      const existing = await findDmChat(allParticipantIds[0], allParticipantIds[1]);
      chat = existing ?? (await createDmChat(allParticipantIds[0], allParticipantIds[1], userId))!;
    } else {
      chat = await prisma.standardChats.create({
        data: {
          type: 'group',
          name: name || 'No name',
          created_by: userId,
          avatar_url: null,
        },
        include: {
          StandardChatMembers: {
            include: {
              USERS: { select: { id: true, user_name: true, image_url: true } },
            },
          },
        },
      });
    }

    const otherMembers = chat.StandardChatMembers.filter((member) => member.user_id !== userId);
    const displayName = chat.name || otherMembers.map((member) => member.USERS.user_name).join(', ') || 'Unknown';
    const avatarUrl = chat.avatar_url || otherMembers[0]?.USERS?.image_url || null;

    res.json({
      chat: {
        id: chat.id,
        name: displayName,
        avatar_url: avatarUrl,
        lastMessage: '',
        timestamp: chat.created_at instanceof Date ? chat.created_at.getTime() : new Date(chat.created_at).getTime(),
        unread: 0,
        type: chat.type,
        messageCount: 0,
        members: chat.StandardChatMembers.map((m) => ({
          id: m.USERS.id,
          user_name: m.USERS.user_name,
          image_url: m.USERS.image_url,
        })),
      },
    });
  } catch (error) {
    console.error('[chat:POST /] error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

ChatRouter.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;

  const memberships = await prisma.standardChatMembers.findMany({
    where: { user_id: userId },
    orderBy: { last_read_at: 'desc' },
    include: {
      StandardChats: {
        include: {
          StandardChatMessages: {
            orderBy: { created_at: 'desc' },
            take: 1,
            select: { content: true, created_at: true, sender_id: true },
          },
          StandardChatMembers: {
            where: { user_id: { not: userId } },
            include: {
              USERS: { select: { id: true, user_name: true, image_url: true } },
            },
          },
        },
      },
    },
  });

  const transformed = memberships.map((m) => {
    const chat = m.StandardChats;
    const otherMembers = chat.StandardChatMembers;
    const lastMsg = chat.StandardChatMessages[0];

    return {
      id: chat.id,
      name: chat.name || otherMembers.map((o) => o.USERS.user_name).join(', ') || 'Unknown',
      avatar_url: chat.avatar_url || otherMembers[0]?.USERS?.image_url || null,
      lastMessage: lastMsg?.content || '',
      timestamp: (lastMsg?.created_at ?? chat.updated_at).getTime(),
      unread: 0,
      type: chat.type,
      messageCount: 0,
      members: otherMembers.map((cm) => ({
        id: cm.USERS.id,
        user_name: cm.USERS.user_name,
        image_url: cm.USERS.image_url,
      })),
    };
  });
  
  res.json({ chats: transformed });
});

ChatRouter.get('/:chatId/messages', authenticate, async (req, res) => {
  const chatId = req.params.chatId as string;
  const userId = req.user?.id;
  const before = req.query.before as string | undefined;

  console.log(`[chat:GET /:chatId/messages] fetching messages for chat ${chatId} by user ${userId}${before ? ` before ${before}` : ''}`);

  const limit = 20;

  try {
    const where: Record<string, unknown> = { chat_id: chatId };
    if (before) {
      where.created_at = { lt: new Date(before) };
    }

    const messages = await prisma.standardChatMessages.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        USERS: {
          select: { id: true, user_name: true, image_url: true },
        },
      },
    });

    messages.reverse();

    const hasMore = messages.length === limit;

    console.log(`[chat:GET /:chatId/messages] found ${messages.length} messages for chat ${chatId} (hasMore: ${hasMore})`);

    res.json({ messages, hasMore });
  } catch (error) {
    console.error(`[chat:GET /:chatId/messages] error for chat ${chatId}:`, error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

ChatRouter.post('/:chatId/:userId/appendMessage', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    await refreshUserAccessToken(req, res);
    if (!req.user) {
      res.status(401).json({error: 'Unauthorized' });
      return;
    }
  }
  if (!req.params.userId){
    res.status(400).json({error:'UserId is required'});
    return;
  }

  if (!req.params.chatId){
    res.status(400).json({error:'ChatId is required'});
    return;
  }

  const chatId = req.params.chatId as string;
  const userId = req.user.id;
  const { content } = req.body as { content: string };
  console.log(`[chat:POST /:chatId/messages] user ${userId} wants to send a message to chat ${chatId}`);

  if (!content || typeof content !== 'string') {
    console.log('[chat:POST /:chatId/messages] validation failed: content missing or invalid');
    res.status(400).json({ error: 'content is required and must be a string' });
    return;
  }

  try {
    const newMessage = await prisma.standardChatMessages.create({
      data: {
        chat_id: chatId,
        sender_id: userId,
        content,
      },
    });

    console.log(`[chat:POST /:chatId/messages] message created with id ${newMessage.id} in chat ${chatId}`);
    console.log(`[chat:POST /:chatId/messages] the message with id ${newMessage.id} in chat ${chatId} is about to be BROADCASTED`);

    broadcastToRoom(chatId,newMessage);

    await prisma.standardChats.update({
      where: { id: chatId },
      data: { updated_at: new Date() },
    });
    console.log(`[chat:POST /:chatId/messages] chat ${chatId} updated_at refreshed`);

    res.status(201).json({ message: newMessage });
  } catch (error) {
    console.error(`[chat:POST /:chatId/messages] error for chat ${chatId}:`, error);
    res.status(500).json({ error: 'Failed to append message' });
  }
});

ChatRouter.patch('/:chatId/messages/:messageId/:userId', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    await refreshUserAccessToken(req, res);
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  if (!req.params.userId){
    res.status(400).json({error:'UserId is required'});
    return;
  }
  if (!req.params.chatId){
    res.status(400).json({error:'ChatId is required'});
    return;
  }
  if (!req.params.messageId){
    res.status(400).json({error:'MessageId is required'});
    return;
  }

  const chatId = req.params.chatId as string;
  const messageId = req.params.messageId as string;
  const userId = req.params.userId;
  const { content } = req.body as { content?: string };

  console.log(`[chat:PATCH /:chatId/messages/:messageId] user ${userId} updating message ${messageId} in chat ${chatId}`);

  if (!content || typeof content !== 'string') {
    console.log(`[chat:PATCH /:chatId/messages/:messageId] validation failed: content missing or invalid`);
    res.status(400).json({ error: 'content is required and must be a string' });
    return;
  }

  try {
    const existing = await prisma.standardChatMessages.findUnique({
      where: { id: messageId },
    });

    if (!existing) {
      console.log(`[chat:PATCH /:chatId/messages/:messageId] message ${messageId} not found`);
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (existing.sender_id !== userId) {
      console.log(`[chat:PATCH /:chatId/messages/:messageId] user ${userId} not authorized to edit message ${messageId}`);
      res.status(403).json({ error: 'Not authorized to edit this message' });
      return;
    }

    const updated = await prisma.standardChatMessages.update({
      where: { id: messageId },
      data: {
        content,
        is_edited: true,
      },
      include: {
        USERS: {
          select: { id: true, user_name: true, image_url: true },
        },
      },
    });

    console.log(`[chat:PATCH /:chatId/messages/:messageId] message ${messageId} updated successfully`);

    await prisma.standardChats.update({
      where: { id: chatId },
      data: { updated_at: new Date() },
    });

    res.json({ message: updated });
  } catch (error) {
    console.error(`[chat:PATCH /:chatId/messages/:messageId] error updating message ${messageId}:`, error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

ChatRouter.delete('/:chatId/messages/:messageId/:userId', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    await refreshUserAccessToken(req, res);
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  if (!req.params.userId){
    res.status(400).json({error:'UserId is required'});
    return;
  }
  if (!req.params.chatId){
    res.status(400).json({error:'ChatId is required'});
    return;
  }
  if (!req.params.messageId){
    res.status(400).json({error:'MessageId is required'});
    return;
  }
  
  const chatId = req.params.chatId as string;
  const messageId = req.params.messageId as string;
  const userId = req.params.userId;

  console.log(`[chat:DELETE /:chatId/messages/:messageId] user ${userId} deleting message ${messageId} in chat ${chatId}`);

  try {
    const existing = await prisma.standardChatMessages.findUnique({
      where: { id: messageId },
    });

    if (!existing) {
      console.log(`[chat:DELETE /:chatId/messages/:messageId] message ${messageId} not found`);
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (existing.sender_id !== userId) {
      console.log(`[chat:DELETE /:chatId/messages/:messageId] user ${userId} not authorized to delete message ${messageId}`);
      res.status(403).json({ error: 'Not authorized to delete this message' });
      return;
    }

    await prisma.standardChatMessages.delete({
      where: { id: messageId },
    });

    console.log(`[chat:DELETE /:chatId/messages/:messageId] message ${messageId} deleted successfully`);

    res.json({ success: true });
  } catch (error) {
    console.error(`[chat:DELETE /:chatId/messages/:messageId] error deleting message ${messageId}:`, error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default ChatRouter;
