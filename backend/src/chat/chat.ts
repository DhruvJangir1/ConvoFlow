import { Router } from 'express';
import type { Request, Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/connectionPoolClient.js';
import { broadcastToRoom } from '../../ws/websocket.js';
import { findDmChat, createDmChat } from '../services/dmChat.js';
import { uploadImageToStorage, signImageUrl } from '../services/imageUpload.js';
import { signChatAvatar, signMemberImages, signSenderImage } from './chatImageHelpers.js';

type ChatUploadRequest = Request & {
  file?: {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
  };
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: Request, file: { mimetype: string }, cb: FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files are allowed'));
  },
});

console.log('[chat module] backend/src/chat/chat.ts loaded');

async function requireChatMembership(userId: string, chatId: string): Promise<boolean> {
  console.log(`[requireChatMembership] checking membership for user ${userId} in chat ${chatId}`);
  const membership = await prisma.standardChatMembers.findUnique({
    where: { chat_id_user_id:{ chat_id:chatId, user_id:userId } },
    select: { user_id: true },
  });
  console.log(`[requireChatMembership] membership result for user ${userId} in chat ${chatId}: ${membership ? 'FOUND' : 'NOT_FOUND'}`);
  
  const memberShipExists = membership !== null;
  console.log(`[requireChatMembership] ${memberShipExists}`)
  
  return memberShipExists
}

const ChatRouter = Router();

ChatRouter.post('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user){
    res.status(401).json({error:'Unauthorized'});
    return;
  }

  const userId = req.user.id;
  console.log(`[chat:POST /] user ${userId} initiating chat creation`);
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
    const avatarUrl = await signChatAvatar(chat.avatar_url, otherMembers[0]?.USERS?.image_url ?? null);
    const signedMembers = await signMemberImages(
      chat.StandardChatMembers.map((m) => ({
        id: m.USERS.id,
        user_name: m.USERS.user_name,
        image_url: m.USERS.image_url,
      }))
    );

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
        members: signedMembers,
      },
    });
  } catch (error) {
    console.error('[chat:POST /] error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

ChatRouter.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  console.log('[chatRouter] just entered the get request endpoint')
  if (!req.user) {
    console.log('UNAUTHORIZEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD')
    res.status(401).json({ error: 'UNAUTHORIZEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD' });
    return;
  }

  const userId = req.user.id;

  console.log('[chatRouter] About to get user chats')
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
            include: {
              USERS: { select: { id: true, user_name: true, image_url: true } },
            },
          },
        },
      },
    },
  });
  console.log('[chatRouter] just got user chats')
  const transformed = await Promise.all(memberships.map(async (m) => {
    const chat = m.StandardChats;
    const otherMembers = chat.StandardChatMembers;
    const lastMsg = chat.StandardChatMessages[0];

    const avatarUrl = await signChatAvatar(chat.avatar_url, otherMembers[0]?.USERS?.image_url ?? null);
    const signedMembers = await signMemberImages(
      otherMembers.map((cm) => ({
        id: cm.USERS.id,
        user_name: cm.USERS.user_name,
        image_url: cm.USERS.image_url,
      }))
    );

    return {
      id: chat.id,
      name: chat.name || otherMembers.map((o) => o.USERS.user_name).join(', ') || 'Unknown',
      avatar_url: avatarUrl,
      lastMessage: lastMsg?.content || '',
      timestamp: (lastMsg?.created_at ?? chat.updated_at).getTime(),
      unread: 0,
      type: chat.type,
      messageCount: 0,
      members: signedMembers,
    };
  }));
  
  res.json({ chats: transformed });
});

ChatRouter.post('/:chatId/image', authenticate, upload.single('image'), async (req: ChatUploadRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const chatId = req.params.chatId as string;
  const userId = req.user.id;
  const { type = 'image' } = req.body as { type?: string };
  const file = req.file;
  console.log(`[chat:POST /:chatId/image] user ${userId} uploading image to chat ${chatId} (type=${type})`);
  if (!file) {
    res.status(400).json({ error: 'image file is required' });
    return;
  }

  if (!await requireChatMembership(userId, chatId)) {
    res.status(403).json({ error: 'Not a member of this chat' });
    return;
  }

  try {
    const uploadResult = await uploadImageToStorage({
      userId,
      fileName: file.originalname,
      contentType: file.mimetype,
      buffer: file.buffer,
    });

    const message = await prisma.standardChatMessages.create({
      data: {
        chat_id: chatId,
        sender_id: userId,
        message_type: type,
        content: uploadResult.path,
      },
      include: {
        USERS: {
          select: { id: true, user_name: true, image_url: true },
        },
      },
    });

    await prisma.standardChats.update({
      where: { id: chatId },
      data: { updated_at: new Date() },
    });

    const signedSenderImage = await signSenderImage(message.USERS.image_url ?? null);

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: {
        id: message.id,
        chatId,
        senderId: message.sender_id,
        senderName: message.USERS.user_name ?? userId,
        senderImage: signedSenderImage,
        content: uploadResult.url,
        createdAt: message.created_at,
        messageType: message.message_type,
      },
    });

    res.status(201).json({
      success: true,
      message: {
        id: message.id,
        chatId,
        senderId: message.sender_id,
        senderName: message.USERS.user_name ?? userId,
        senderImage: signedSenderImage,
        content: uploadResult.url,
        messageType: message.message_type,
        createdAt: message.created_at,
      },
      url: uploadResult.url,
      path: uploadResult.path,
    });
  } catch (error) {
    console.error(`[chat:POST /:chatId/image] error for chat ${chatId}:`, error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Image upload failed' });
  }
});

ChatRouter.get('/:chatId/messages', authenticate, async (req, res) => {

  if (!req.user){
    res.status(401).json({err:'Unauthorized'});
    return;
  }

  const chatId = req.params.chatId as string;
  const userId = req.user.id;
  const before = req.params.before as string | undefined;

  console.log(`[chat:GET /:chatId/messages] fetching messages for chat ${chatId} by user ${userId}${before ? ` before ${before}` : ''}`);

  if (!userId || !await requireChatMembership(userId, chatId)) {
    res.status(403).json({ error: 'Not a member of this chat' });
    return;
  }

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

    const signedMessages = await Promise.all(
      messages.map(async (msg) => {
        const signedContent = (msg.message_type === 'image' && msg.content)
          ? await signImageUrl(msg.content)
          : msg.content;
        const signedSenderImage = await signSenderImage(msg.USERS.image_url ?? null);
        return { ...msg, content: signedContent, USERS: { ...msg.USERS, image_url: signedSenderImage } };
      }),
    );

    const hasMore = signedMessages.length === limit;

    console.log(`[chat:GET /:chatId/messages] found ${signedMessages.length} messages for chat ${chatId} (hasMore: ${hasMore})`);

    res.json({ messages: signedMessages, hasMore });
  } catch (error) {
    console.error(`[chat:GET /:chatId/messages] error for chat ${chatId}:`, error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

ChatRouter.post('/:chatId/:userId/appendMessage', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({error: 'Unauthorized' });
    return;
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

  if (!await requireChatMembership(userId, chatId)) {
    res.status(403).json({ error: 'Not a member of this chat' });
    return;
  }

  try {

    const newMessage = await prisma.standardChatMessages.create({
      data: {
        chat_id: chatId,
        sender_id: userId,
        content: content,
      },
      include: {
        USERS: {
          select: { id: true, user_name: true, image_url: true },
        },
      },
    });

    console.log(`[chat:POST /:chatId/messages] message created with id ${newMessage.id} in chat ${chatId}`);
    console.log(`[chat:POST /:chatId/messages] the message with id ${newMessage.id} in chat ${chatId} is about to be BROADCASTED`);

    const signedSenderImage = await signSenderImage(newMessage.USERS.image_url ?? null);

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: {
        id: newMessage.id,
        chatId,
        senderId: newMessage.sender_id,
        senderName: newMessage.USERS.user_name ?? userId,
        senderImage: signedSenderImage,
        content: newMessage.content,
        createdAt: newMessage.created_at,
      },
    });

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
    res.status(401).json({ error: 'Unauthorized' });
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
  const userId = req.user.id;
  const { content } = req.body as { content?: string };

  console.log(`[chat:PATCH /:chatId/messages/:messageId] user ${userId} updating message ${messageId} in chat ${chatId}`);

  if (!content || typeof content !== 'string') {
    console.log(`[chat:PATCH /:chatId/messages/:messageId] validation failed: content missing or invalid`);
    res.status(400).json({ error: 'content is required and must be a string' });
    return;
  }

  if (!await requireChatMembership(userId, chatId)) {
    res.status(403).json({ error: 'Not a member of this chat' });
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
    res.status(401).json({ error: 'Unauthorized' });
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
  const userId = req.user.id;

  console.log(`[chat:DELETE /:chatId/messages/:messageId] user ${userId} deleting message ${messageId} in chat ${chatId}`);

  if (!await requireChatMembership(userId, chatId)) {
    res.status(403).json({ error: 'Not a member of this chat' });
    return;
  }

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

    broadcastToRoom(chatId, {
      type: 'message:delete',
      payload: { chatId, messageId, senderId: userId, isAnonymous: false },
    });

    console.log(`[chat:DELETE /:chatId/messages/:messageId] message ${messageId} deleted successfully`);

    res.json({ success: true });
  } catch (error) {
    console.error(`[chat:DELETE /:chatId/messages/:messageId] error deleting message ${messageId}:`, error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default ChatRouter;
