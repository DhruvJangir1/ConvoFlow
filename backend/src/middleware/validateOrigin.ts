import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();
const rawAllowedOrigin = process.env.CORS_ORIGIN;
if (!rawAllowedOrigin) {
  throw new Error('CRITICAL: CORS_ORIGIN must be set');
}

const ALLOWED_ORIGIN: string | URL = rawAllowedOrigin;

function resolveOrigin(value: string | URL): URL {
  return value instanceof URL ? value : new URL(value);
}

export function validateOrigin(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'OPTIONS', 'HEAD'].includes(req.method)) return next();

  if (process.env.NODE_ENV === 'production') {
    const forwardedHost = req.headers['x-forwarded-host'];
    const origin = req.headers.origin;

    if (forwardedHost) {
      const allowedHost = resolveOrigin(ALLOWED_ORIGIN).host;
      const firstHost = Array.isArray(forwardedHost)
        ? forwardedHost[0]
        : forwardedHost.split(',')[0].trim();
      if (firstHost === allowedHost) return next();
    }

    if (origin) {
      try {
        if (new URL(origin.toString()).origin === resolveOrigin(ALLOWED_ORIGIN).origin) return next();
      } catch {
        /* invalid origin format — fall through to block */
      }
    }

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

  if (originStr !== resolveOrigin(ALLOWED_ORIGIN).origin) {
    return res.status(403).json({ error: 'Invalid Origin' });
  }

  return next();
}
