import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

export function validateOrigin(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'OPTIONS', 'HEAD'].includes(req.method)) return next();

  if (process.env.NODE_ENV === 'production') {
    const forwardedHost = req.headers['x-forwarded-host'];
    if (!forwardedHost) return res.status(403).json({ error: 'Invalid Origin' });

    const allowedHost = new URL(ALLOWED_ORIGIN).host;
    const firstHost = Array.isArray(forwardedHost)
      ? forwardedHost[0]
      : forwardedHost.split(',')[0].trim();
    if (firstHost === allowedHost) return next();

    return res.status(403).json({ error: 'Invalid Origin' });
  }

  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return res.status(403).json({ error: 'Missing Origin/Referer header' });

  let originStr: string;
  try {
    originStr = new URL(origin.toString()).origin;
  } catch {
    return res.status(403).json({ error: 'Invalid Origin format' });
  }

  if (originStr !== ALLOWED_ORIGIN) {
    return res.status(403).json({ error: 'Invalid Origin' });
  }

  return next();
}
