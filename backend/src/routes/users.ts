import { Router } from 'express';
import type { Request, Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/connectionPoolClient.js';
import { uploadImageToStorage } from '../services/imageUpload.js';

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
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files are allowed'));
  },
});

UserRouter.get('/search', authenticate, async (req: Request, res: Response): Promise<void> => {
  const query = (req.query.q as string || '').trim();
  const userId = req.user!.id;

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
    select: { id: true, user_name: true, email: true, image_url: true, is_verified: true, user_tag: true },
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
      data: { image_url: uploadResult.url },
    });

    console.log(`[UserRouter] user ${req.user.id} image_url updated in DB`);
    res.json({ success: true, imageUrl: uploadResult.url });
  } catch (error) {
    console.error('[UserRouter] profile image upload error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to upload profile image' });
  }
});

export default UserRouter;
