import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { generateTicket } from '../services/wsTicketStore.js';

const WsTicketRouter = Router();

WsTicketRouter.get('/ws-ticket', authenticate, async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const ticket = generateTicket(req.user.id);
  res.json({ ticket });
});

export default WsTicketRouter;
