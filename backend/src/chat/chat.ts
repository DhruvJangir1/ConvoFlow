import { Router } from 'express';
import type { Request, Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/connectionPoolClient.js';
import { findDmChat, createDmChat } from '../services/dmChat.js';
import { uploadImageToStorage, signImageUrl } from '../services/imageUpload.js';
import { signChatAvatar, signMemberImages, signSenderImage } from './chatImageHelpers.js';
import { broadcastToRoom } from '../../ws/websocket.js';
import { requireChatMembership } from '../services/chatMessageService.js';

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
    if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml') {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files are allowed'));
  },
});

console.log('[chat module] backend/src/chat/chat.ts loaded');

const ChatRouter = Router();

function formatCursorTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, -1).replace('T', ' ')}000+00`;
}

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
    const firstOther = otherMembers[0];
    const avatarUrl = await signChatAvatar(chat.avatar_url, firstOther ? firstOther.USERS.image_url : null);
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

    const firstOther = otherMembers[0];
    const avatarUrl = await signChatAvatar(chat.avatar_url, firstOther ? firstOther.USERS.image_url : null);
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
      lastMessage: lastMsg ? lastMsg.content : '',
      timestamp: (lastMsg ? lastMsg.created_at : chat.updated_at).getTime(),
      unread: 0,
      type: chat.type,
      messageCount: 0,
      members: signedMembers,
    };
  }));
  
  res.json({ chats: transformed });
});

ChatRouter.get('/subscribed-ids', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const userId = req.user.id;

  const standardMemberships = await prisma.standardChatMembers.findMany({
    where: { user_id: userId },
    select: { chat_id: true },
  });
  const anonymousRooms = await prisma.anonymousChats.findMany({
    orderBy: { updated_at: 'desc' },
    take: 20,
    select: { id: true },
  });

  res.json({
    chatIds: [
      ...new Set([
        ...standardMemberships.map((membership) => membership.chat_id),
        ...anonymousRooms.map((room) => room.id),
      ]),
    ],
  });
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
  const beforeCreatedAt = req.query.beforeCreatedAt as string | undefined;
  const beforeId = req.query.beforeId as string | undefined;

  if ((beforeCreatedAt && !beforeId) || (!beforeCreatedAt && beforeId)) {
    res.status(400).json({ error: 'beforeCreatedAt and beforeId must be provided together' });
    return;
  }

  const parsedBeforeDate = beforeCreatedAt ? new Date(beforeCreatedAt) : null;
  if (parsedBeforeDate && Number.isNaN(parsedBeforeDate.getTime())) {
    res.status(400).json({ error: 'beforeCreatedAt must be a valid date' });
    return;
  }

  console.log(`[chat:GET /:chatId/messages] fetching messages for chat ${chatId} by user ${userId}${beforeCreatedAt ? ` before ${beforeCreatedAt}/${beforeId}` : ''}`);

  if (!userId || !await requireChatMembership(userId, chatId)) {
    res.status(403).json({ error: 'Not a member of this chat' });
    return;
  }

  const limit = 20;

  try {
    const cursorFilter = parsedBeforeDate && beforeId
      ? {
          OR: [
            { created_at: { lt: parsedBeforeDate } },
            { created_at: parsedBeforeDate, id: { lt: beforeId } },
          ],
        }
      : {};

    const messages = await prisma.standardChatMessages.findMany({
      where: { chat_id: chatId, ...cursorFilter },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
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
        return {
          ...msg,
          content: signedContent,
          USERS: { ...msg.USERS, image_url: signedSenderImage },
        };
      }),
    );

    const hasMore = signedMessages.length === limit;

    console.log(`[chat:GET /:chatId/messages] found ${signedMessages.length} messages for chat ${chatId} (hasMore: ${hasMore})`);

    const oldestMessage = signedMessages[0];
    const nextCursor = oldestMessage
      ? { beforeCreatedAt: formatCursorTimestamp(oldestMessage.created_at), beforeId: oldestMessage.id }
      : null;

    res.json({ messages: signedMessages, hasMore, nextCursor });
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
    // Look up sender info for the broadcast
    const sender = await prisma.users.findUnique({
      where: { id: userId },
      select: { user_name: true, image_url: true },
    });

    if(!sender){
      res.status(404).json({error:'User Not Found'})
      console.log('[/chat/appendMessage] sender not found')
      return;
    }

    const signedSenderImage = await signSenderImage(sender.image_url ?? null);
    const senderName = sender.user_name ?? userId.slice(0, 8);

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

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: {
        id: newMessage.id,
        chatId,
        senderId: userId,
        senderName,
        senderImage: signedSenderImage,
        content: newMessage.content,
        createdAt: newMessage.created_at.toISOString(),
        isEdited: false,
        messageType: 'text',
      },
    });
      console.log(`broadcasted msg: ${Date.now()}`)

    console.log(`[chat:POST /:chatId/messages] ✓ Broadcasted message to room ${chatId}`);
    prisma.standardChats.update({
      where: { id: chatId },
      data: { updated_at: new Date() },
    });


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


    console.log(`[chat:DELETE /:chatId/messages/:messageId] message ${messageId} deleted successfully`);

    res.json({ success: true });
  } catch (error) {
    console.error(`[chat:DELETE /:chatId/messages/:messageId] error deleting message ${messageId}:`, error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default ChatRouter;
