import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/connectionPoolClient.js';
import { uploadImageToStorage } from '../services/imageUpload.js';
import { broadcastToRoom } from '../../ws/websocket.js';

const ImageUploadRouter = Router();

ImageUploadRouter.post('/image', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { fileName, base64Data, contentType, chatId, type = 'image' } = req.body as {
      fileName?: string;
      base64Data?: string;
      contentType?: string;
      chatId?: string;
      type?: string;
    };

    if (!fileName || !base64Data) {
      res.status(400).json({ error: 'fileName and base64Data are required' });
      return;
    }

    if (!chatId) {
      res.status(400).json({ error: 'chatId is required' });
      return;
    }

    const userId = req.user.id;
    const uploadResult = await uploadImageToStorage({
      userId,
      fileName,
      base64Data,
      contentType,
    });

    const message = await prisma.standardChatMessages.create({
      data: {
        chat_id: chatId,
        sender_id: userId,
        message_type: type,
        content: uploadResult.url,
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

    broadcastToRoom(chatId, {
      type: 'message:new',
      payload: {
        id: message.id,
        chatId,
        senderId: message.sender_id,
        senderName: message.USERS.user_name ?? userId,
        senderImage: message.USERS.image_url ?? null,
        content: message.content,
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
        senderImage: message.USERS.image_url ?? null,
        content: message.content,
        messageType: message.message_type,
        createdAt: message.created_at,
      },
      url: uploadResult.url,
      path: uploadResult.path,
    });
  } catch (error) {
    console.error('[imageUpload] upload failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Image upload failed' });
  }
});

export default ImageUploadRouter;
