import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/connectionPoolClient.js';

const UserRouter = Router();

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

export default UserRouter;
