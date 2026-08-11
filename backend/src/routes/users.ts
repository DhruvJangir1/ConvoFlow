import { Router } from 'express';
import type { Request, Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/connectionPoolClient.js';
import { uploadImageToStorage } from '../services/imageUpload.js';
import { signChatAvatar, signMemberImages } from '../chat/chatImageHelpers.js';

const UserRouter = Router();

type ProfileImageRequest = Request & {
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

UserRouter.get('/search', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user){
    res.status(404).json({error:'User Not Found'})
    return;
  }
  const query = (req.query.q as string || '').trim();
  const userId = req.user.id;

  if (!query || query.length < 1) {
    res.json({ users: [] });
    return;
  }

  const users = await prisma.users.findMany({
    where: {
      AND: [
        { id: { not: userId } },
        {
          OR: [
            { user_name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
      ],
    },
    select: { id: true, user_name: true, image_url: true, is_verified: true, user_tag: true },
    take: 20,
  });

  res.json({ users });
});

UserRouter.patch('/profile-image', authenticate, upload.single('image'), async (req: ProfileImageRequest, res: Response): Promise<void> => {
  console.log('[UserRouter] PATCH /profile-image hit');
  if (!req.user) {
    console.log('[UserRouter] no user on request, sending 401');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const file = req.file;
  if (!file) {
    console.log('[UserRouter] no file attached, sending 400');
    res.status(400).json({ error: 'Image file is required' });
    return;
  }

  console.log(`[UserRouter] user ${req.user.id} uploading profile image: ${file.originalname} (${file.mimetype}, ${file.buffer.length} bytes)`);

  try {
    const uploadResult = await uploadImageToStorage({
      userId: req.user.id,
      fileName: file.originalname,
      contentType: file.mimetype,
      buffer: file.buffer,
    });

    console.log(`[UserRouter] image uploaded to S3, path: ${uploadResult.path}`);

    await prisma.users.update({
      where: { id: req.user.id },
      data: { image_url: uploadResult.path },
    });

    console.log(`[UserRouter] user ${req.user.id} image_url updated in DB`);
    res.json({ success: true, imageUrl: uploadResult.url });
  } catch (error) {
    console.error('[UserRouter] profile image upload error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to upload profile image' });
  }
});

UserRouter.patch('/:userId/update-bio', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.user.id !== req.params.userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { bio } = req.body as { bio: string };

  if (!bio) {
    res.status(400).json({ error: 'Bio is required' });
    return;
  }

  try {
    const updated = await prisma.users.update({
      where: { id: req.user.id },
      data: { bio },
      select: { id: true, bio: true },
    });

    res.json({ success: true, bio: updated.bio });
  } catch (error) {
    console.error('[UserRouter] update bio error:', error);
    res.status(500).json({ error: 'Failed to update bio' });
  }
});

UserRouter.get('/:userId/fetch-chatNames', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.params.userId !== req.user.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const userId = req.user.id;

  const memberships = await prisma.standardChatMembers.findMany({
    where: { user_id: userId },
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

  const transformed = await Promise.all(memberships.map(async (m) => {
    const chat = m.StandardChats;
    const allMembers = chat.StandardChatMembers;
    const otherMembers = allMembers.filter((member) => member.USERS.id !== userId);
    const lastMsg = chat.StandardChatMessages[0];

    let displayName: string;
    let avatarUrl: string | null;

    if (chat.type === 'dm' && otherMembers.length === 1) {
      displayName = otherMembers[0].USERS.user_name || 'Unknown';
      avatarUrl = await signChatAvatar(null, otherMembers[0].USERS.image_url);
    } else {
      displayName = chat.name || otherMembers.map((o) => o.USERS.user_name).join(', ') || 'Unknown';
      avatarUrl = await signChatAvatar(chat.avatar_url, null);
    }

    const signedMembers = await signMemberImages(
      allMembers.map((cm) => ({
        id: cm.USERS.id,
        user_name: cm.USERS.user_name,
        image_url: cm.USERS.image_url,
      }))
    );

    return {
      id: chat.id,
      name: displayName,
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

export default UserRouter;
