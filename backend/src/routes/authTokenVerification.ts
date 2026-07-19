import { Router } from 'express';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { verifyAccessToken, signAccessToken, rotateRefreshTokenWithLock } from '../services/auth.js';
import { PRISMA_SAFE_SELECT } from '../util/constants.js';
import { COOKIE_OPTIONS } from '../util/constants.js';
import { prisma } from "../lib/connectionPoolClient.js";
import { clearAuthCookies, setAuthCookies } from '../services/authCookieSessions.js';
import { resolveImageUrl } from '../services/imageUpload.js';
import dotenv from 'dotenv';

dotenv.config();

const AuthTokenVerificationRouter = Router();

async function withSignedImageUrl<T extends { image_url: string | null }>(user: T): Promise<T> {
  if (user.image_url) {
    return { ...user, image_url: await resolveImageUrl(user.image_url) };
  }
  return user;
}

AuthTokenVerificationRouter.get('/session', async (req: Request, res: Response): Promise<void> => {
  if (!req.cookies) {
    res.status(400).json({ error: 'No cookies found' });
    return;
  }

  const accessToken = req.cookies.access_token;

  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);

      const user = await prisma.users.findFirst({
        where: { id: payload.sub },
        select: PRISMA_SAFE_SELECT,
      });

      if (!user) {
        res.json({ user: null });
        return;
      }

      res.cookie('access_token', accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      });
      res.json({ user: await withSignedImageUrl(user), accessTokenExpiresAt: Date.now() + 15 * 60 * 1000 });
      return;

    } 
    catch (err) {
      const isExpired = err instanceof Error && err.name === 'TokenExpiredError';

      if (!isExpired) {
        res.json({ user: null });
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
      }
    }
  }

  if (!req.user) {
    const userId = req.cookies.user_id;
    const refreshToken = req.cookies.refresh_token;

    if (!userId || !refreshToken) {
      res.json({ user: null });
      return;
    }

    try {
      const result = await rotateRefreshTokenWithLock(userId, refreshToken);
      setAuthCookies(res, result.accessToken, result.refreshToken, result.refreshSalt, result.user.id);
      req.user = result.user;
    } catch {
      res.json({ user: null });
      return;
    }
  }

  const user = await prisma.users.findFirst({
    where: { id: req.user.id },
    select: PRISMA_SAFE_SELECT,
  });
  
  if (!user) {
    res.json({ user: null });
    return;
  }

  res.json({ user: await withSignedImageUrl(user), accessTokenExpiresAt: Date.now() + 15 * 60 * 1000 });
});

AuthTokenVerificationRouter.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  if (!req.cookies) {
    return;
  }

  const refreshToken = req.cookies.refresh_token;
  const userId = req.cookies.user_id;

  if (!refreshToken || !userId) {
    res.status(401).json({ error: 'Refresh token missing' });
    return;
  }

  try {
    const result = await rotateRefreshTokenWithLock(userId, refreshToken);
    setAuthCookies(res, result.accessToken, result.refreshToken, result.refreshSalt, result.user.id);
    res.json({ message: 'Tokens refreshed', accessTokenExpiresAt: Date.now() + 15 * 60 * 1000 });
  } catch {
    clearAuthCookies(res);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

export default AuthTokenVerificationRouter
