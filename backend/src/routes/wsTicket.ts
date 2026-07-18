import { Router } from 'express';
import type { Request, Response } from 'express';
import { generateTicket } from '../services/wsTicketStore';
import { authenticate } from '../middleware/authenticate';

const WsTicketRouter = Router();

WsTicketRouter.get('/ws-ticket', authenticate, (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const ticket = generateTicket(req.user.id);
  console.log(`[ws-ticket] Generated ticket for user ${req.user.id}: ${ticket}`);
  res.json({ ticket });
});

export default WsTicketRouter;
