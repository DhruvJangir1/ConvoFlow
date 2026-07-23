import { Router } from 'express'
import type { Request, Response } from 'express';
import AuthUserVerificaitonRouter from './authUserVerification.js';
import WsTicketRouter from './wsTicket.js';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/connectionPoolClient.js';
import { PRISMA_SAFE_SELECT } from '../util/constants.js';

const AuthRouter = Router();

AuthRouter.post('/setup-user', authenticate, async (req: Request, res: Response): Promise<void> => {
  console.log('[setup-user] ── POST /api/auth/setup-user ──');

  if (!req.user) {
    console.log('[setup-user] ✗ req.user is null after authenticate');
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  console.log(`[setup-user] req.user.id = ${req.user.id}, fetching from DB...`);
  const user = await prisma.users.findUnique({
    where: { id: req.user.id },
    select: PRISMA_SAFE_SELECT,
  });

  if (!user) {
    console.log(`[setup-user] ✗ User not found in DB for id: ${req.user.id}`);
    res.status(404).json({ error: 'User not found' });
    return;
  }

  console.log(`[setup-user] ✓ Returning user: ${user.user_name} (${user.email})`);
  res.json({ user });
});

AuthRouter.use("/UserVerificaitonRouter",AuthUserVerificaitonRouter);
AuthRouter.use("/WsTicketRouter", WsTicketRouter);

export default AuthRouter;
