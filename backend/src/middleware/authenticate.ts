import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccessToken, signAccessToken, rotateRefreshToken } from '../services/auth.js';
import { setAuthCookies } from '../services/authCookieSessions.js';
import { COOKIE_OPTIONS } from '../util/constants.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
    };
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.cookies) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const accessToken = req.cookies.access_token;

  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      req.user = { id: payload.sub, email: payload.email };
      next();
      return;
    } catch (err) {
      const isExpired = err instanceof Error && err.name === 'TokenExpiredError';
      if (!isExpired) {
        res.status(401).json({ error: 'Invalid access token' });
        return;
      }

      const decoded = jwt.decode(accessToken) as { sub: string; email: string } | null;
      if (decoded && decoded.sub && decoded.email) {
        const newAccessToken = signAccessToken(decoded.sub, decoded.email);
        res.cookie('access_token', newAccessToken, {
          ...COOKIE_OPTIONS,
          maxAge: 15 * 60 * 1000,
        });
        req.user = { id: decoded.sub, email: decoded.email };
        next();
        return;
      }
    }
  }

  const userId = req.cookies.user_id;
  const refreshToken = req.cookies.refresh_token;

  if (!userId || !refreshToken) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const result = await rotateRefreshToken(userId, refreshToken);
    setAuthCookies(res, result.accessToken, result.refreshToken, result.refreshSalt, result.user.id);
    req.user = result.user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
}
