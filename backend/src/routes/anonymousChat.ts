import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/connectionPoolClient.js';
import { broadcastToRoom } from '../../ws/websocket.js';
import { upvote, downvote } from '../services/userMessageVote.js';
import { escapeHtml } from '../util/sanitize.js';

const AnonymousChatRouter = Router();

AnonymousChatRouter.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const rooms = await prisma.anonymousChats.findMany({
      orderBy: { created_at: 'desc' },
      take:20
    });
    res.json({ chats: rooms });
  } catch (error) {
    console.error('[anonymousChat:GET /] error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

AnonymousChatRouter.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const room = await prisma.anonymousChats.findUnique({
      where: { id: req.params.id as string },
    });
    if (!room) {
      res.status(404).json({ error: 'Anonymous room not found' });
      return;
    }
    res.json({ chat: room });
  } catch (error) {
    console.error('[anonymousChat:GET /:id] error:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

AnonymousChatRouter.post('/:id/join', authenticate, async (req: Request, res: Response): Promise<void> => {
    if (!req.user){
        console.log('[anonymous/id/join] NO USER FOUND')
        return;
    }
  const userId = req.user.id;
  const chatId = req.params.id as string;

  try {
    const existing = await prisma.anonymousChatMembers.findUnique({
      where: { id: userId },
    });
    if (existing) {
      res.json({ success: true, member: existing });
      console.log('[anonymous/id/join] user already exists')
      return;
    }

    const member = await prisma.anonymousChatMembers.create({
      data: {
        id: userId,
        chat_id: chatId,
      },
    });
    res.status(201).json({ success: true, member });
  } catch (error) {
    console.error('[anonymousChat:POST /:id/join] error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

AnonymousChatRouter.get('/:id/messages', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user){
    console.log('[anonymous/id/messages] no user found')
    return
  }
  const chatId = req.params.id as string;
  const before = req.query.before as string | undefined;
  const limit = 20;
  const userId = req.user.id;

  try {
    const where: Record<string, unknown> = { chat_id: chatId };
    if (before) {
      where.created_at = { lt: new Date(before) };
    }

    // ge the anonymous chat messages
    const messages = await prisma.anonymousChatMessages.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        created_at: true,
        is_edited: true,
        TotalUpvotes: true,
        isAnonymous: true,
        sender_id: true,
      },
    });

    // find the users who sent non-anonymous msgs (for avatar/name display)
    const senderIds = [...new Set(messages.filter(m => !m.isAnonymous).map(m => m.sender_id as string))];

    const userMap = new Map<string, { id: string; user_name: string; image_url: string | null }>();
    if (senderIds.length > 0) {
      const users = await prisma.users.findMany({
        where: { id: { in: senderIds } },
        select: { id: true, user_name: true, image_url: true },
      });
      for (const u of users) userMap.set(u.id, u);
    }

    const messageIds = messages.map(m => m.id);

    // get user votes
    const userVotes = await prisma.anonymousChatMessagesUserVotes.findMany({
      where: { user_id: userId, message_id: { in: messageIds } },
      select: { message_id: true, type: true },
    });

    const voteMap = new Map(userVotes.map(v => [v.message_id as string, v.type]));

    const messagesWithMeta = messages.map(m => ({
      ...m,
      userVote: voteMap.get(m.id) ?? null,
      users: m.isAnonymous ? null : (userMap.get(m.sender_id as string) ?? null),
    }));

    messagesWithMeta.reverse();
    const hasMore = messages.length === limit;

    res.json({ messages: messagesWithMeta, hasMore });
  } catch (error) {
    console.error('[anonymousChat:GET /:id/messages] error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

AnonymousChatRouter.post('/:id/messages/:userId/:isAnonymous', authenticate, async (req: Request, res: Response): Promise<void> => {
  const chatId = req.params.id as string;
  const userId = req.params.userId as string;
  const isAnon = req.params.isAnonymous === 'true';

  const { content } = req.body as { content: string };

  if (!content || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'content is required and must be a non-empty string' });
    return;
  }

  try {
    const sanitizedContent = escapeHtml(content.trim());

    const message = await prisma.anonymousChatMessages.create({
      data: {
        chat_id: chatId,
        content: sanitizedContent,
        sender_id: userId,
        isAnonymous: isAnon,
      },
    });

    let senderName: string | null = null;
    let senderImage: string | null = null;
    if (!isAnon) {
      const userInfo = await prisma.users.findUnique({
        where: { id: userId },
        select: { user_name: true, image_url: true },
      });
      senderName = userInfo?.user_name ?? null;
      senderImage = userInfo?.image_url ?? null;
    }

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: {
        id: message.id,
        chatId,
        content: message.content,
        createdAt: message.created_at,
        senderId: userId,
        senderName,
        senderImage,
        isAnonymous: isAnon,
      },
    });

    res.status(201).json({ message });
  } catch (error) {
    console.error('[anonymousChat:POST /:id/messages] error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

AnonymousChatRouter.patch('/:id/messages/:messageId', authenticate, async (req: Request, res: Response): Promise<void> => {
  const chatId = req.params.id as string;
  const messageId = req.params.messageId as string;
  const { content } = req.body as { content?: string };

  if (!content || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'content is required and must be a non-empty string' });
    return;
  }

  try {
    const existing = await prisma.anonymousChatMessages.findUnique({
      where: { id: messageId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (existing.chat_id !== chatId) {
      res.status(400).json({ error: 'Message does not belong to this room' });
      return;
    }

    if (existing.sender_id !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to edit this message' });
      return;
    }

    const sanitizedContent = escapeHtml(content.trim());

    const updated = await prisma.anonymousChatMessages.update({
      where: { id: messageId },
      data: {
        content: sanitizedContent,
        is_edited: true,
      },
    });

    res.json({ message: updated });
  } catch (error) {
    console.error('[anonymousChat:PATCH /:id/messages/:messageId] error:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

AnonymousChatRouter.delete('/:id/messages/:messageId', authenticate, async (req: Request, res: Response): Promise<void> => {
  const chatId = req.params.id as string;
  const messageId = req.params.messageId as string;

  try {
    const existing = await prisma.anonymousChatMessages.findUnique({
      where: { id: messageId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (existing.chat_id !== chatId) {
      res.status(400).json({ error: 'Message does not belong to this room' });
      return;
    }

    if (existing.sender_id !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to delete this message' });
      return;
    }

    await prisma.anonymousChatMessages.delete({
      where: { id: messageId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[anonymousChat:DELETE /:id/messages/:messageId] error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

AnonymousChatRouter.post('/:messageId/upvote', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user){
    console.log('[anonymous/:messageId/upvote] no user found')
    return;
  }

  const userId = req.user.id;
  const messageId = req.params.messageId as string;

  try {
    console.log('[anonymous/:messageId/upvote] about to upvote')
    const result = await upvote(userId, messageId);
    console.log('[anonymous/id/messages/:messageId/upvote] successfully upvoted')
    res.json(result);
  } catch (error) {
    console.error('[anonymous/:messageId/upvote] error:', error);
    res.status(500).json({ error: 'Failed to upvote' });
  }
});

AnonymousChatRouter.post('/:messageId/downvote', authenticate, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const messageId = req.params.messageId as string;

  try {
    const result = await downvote(userId, messageId);
    res.json(result);
  } catch (error) {
    console.error('[anonymous POST/:messageId/upvote] error:', error);
    res.status(500).json({ error: 'Failed to downvote' });
  }
});

export default AnonymousChatRouter;
