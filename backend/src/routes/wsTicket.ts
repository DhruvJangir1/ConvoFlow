import { Router } from 'express';
import type { Request, Response } from 'express';
import { verifyAccessToken } from '../services/auth';
import { generateTicket } from '../services/wsTicketStore';

const WsTicketRouter = Router();

WsTicketRouter.get('/ws-ticket', (req: Request, res: Response): void => { // this creates an authorized socket connection between a user and the person who is being talked to
  const token = req.cookies?.access_token;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const ticket = generateTicket(payload.sub);
    console.log(`[ws-ticket] Generated ticket for user ${payload.sub}: ${ticket}`);
    res.json({ ticket });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default WsTicketRouter;
