import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccessToken, refreshUserAccessToken } from '../services/auth.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
    };
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  console.log('[authenticate] === AUTHENTICATE MIDDLEWARE STARTED ===');
  console.log('[authenticate] path:', req.path);
  console.log('[authenticate] method:', req.method);

  if (!req.cookies) {
    console.log('[authenticate] request isnt giving cookies');
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  console.log('[authenticate] cookies object exists, keys:', Object.keys(req.cookies));

  const accesToken = req.cookies.access_token;
  const ip = req.ip || 'unknown';
  console.log(`[authenticate] request from ${ip}, token present: ${accesToken}`);

  if (!accesToken) {
    console.log('[authenticate] no access token, attempting refresh...');
    console.log('[authenticate] calling refreshUserAccessToken...');
    await refreshUserAccessToken(req, res);
    console.log('[authenticate] after refresh, req.user:', JSON.stringify(req.user));
    if (req.user) {
      console.log(`[authenticate] user ${req.user.id} authenticated via refresh token`);
      next();
      return;
    }
    console.log('[authenticate] no token found and refresh failed, sending 401');
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  console.log('[authenticate] access token found, verifying...');
  try {
    const payload = verifyAccessToken(accesToken);
    console.log('[authenticate] token payload:', JSON.stringify(payload));
    req.user = {
      id: payload.sub,
      email: payload.email,
    };
    console.log(`[authenticate] user ${payload.sub} authenticated successfully`);
    next();
    return;
  } catch (err) {
    const isExpired = err instanceof Error && err.name === 'TokenExpiredError';
    console.log(`[authenticate] token validation failed: ${isExpired ? 'expired' : 'invalid'}`);
    console.log('[authenticate] error details:', err instanceof Error ? err.message : err);

    if (!isExpired) {
      console.log('[authenticate] token is invalid (not expired), sending 401');
      res.status(401).json({ error: 'Invalid access token' });
      return;
    }

    console.log('[authenticate] access token expired, decoding payload for user lookup...');
    const decoded = jwt.decode(accesToken) as { sub: string; email: string };
    if (decoded && decoded.sub && decoded.email) {
      req.user = { id: decoded.sub, email: decoded.email };
      console.log(`[authenticate] extracted user ${decoded.sub} from expired token`);
    }

    console.log('[authenticate] calling refreshUserAccessToken...');
    await refreshUserAccessToken(req, res);
    console.log('[authenticate] after refresh, req.user:', JSON.stringify(req.user));
    if (req.user) {
      console.log(`[authenticate] token refreshed for user ${req.user.id}`);
      next();
      return;
    }

    console.log('[authenticate] refresh token invalid/expired too');
    res.set('X-Token-Expired', 'true');
    res.status(401).json({ error: 'Access token expired' });
  }
}