import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/connectionPoolClient.js';

const NotificationRouter = Router();

NotificationRouter.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user){
    res.status(401).json({err:'Unauthorized'})
    return
}

  const userId = req.user.id;
  const { unread } = req.query;

  const where: Record<string, unknown> = { receiver_user_id: userId };
  if (unread === 'true') {
    where.read_at = null;
  }

  const notifications = await prisma.notifications.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: 50,
  });

  res.json({ notifications });
});

NotificationRouter.patch('/:id/read', authenticate, async (req: Request, res: Response): Promise<void> => {
    if (!req.user){
        return;
    }
    
  const userId = req.user.id;
  const { id } = req.params;

  const notification = await prisma.notifications.findUnique({ where: { id: id as string } });

  if (!notification) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  if (notification.receiver_user_id !== userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  const updated = await prisma.notifications.update({
    where: { id: id as string },
    data: { read_at: new Date() },
  });

  res.json({ notification: updated });
});

NotificationRouter.patch('/read-all', authenticate, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  await prisma.notifications.updateMany({
    where: { receiver_user_id: userId, read_at: null },
    data: { read_at: new Date() },
  });

  res.json({ success: true });
});

export default NotificationRouter;
