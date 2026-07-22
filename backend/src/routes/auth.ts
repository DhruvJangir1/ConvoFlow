import { Router } from 'express'
import type { Request, Response } from 'express';
import AuthUserVerificaitonRouter from './authUserVerification.js';
import WsTicketRouter from './wsTicket.js';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/connectionPoolClient.js';
import { PRISMA_SAFE_SELECT } from '../util/constants.js';

const AuthRouter = Router();

AuthRouter.post('/setup-user', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const user = await prisma.users.findUnique({
    where: { id: req.user.id },
    select: PRISMA_SAFE_SELECT,
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user });
});

AuthRouter.use("/UserVerificaitonRouter",AuthUserVerificaitonRouter);
AuthRouter.use("/WsTicketRouter", WsTicketRouter);

export default AuthRouter;
