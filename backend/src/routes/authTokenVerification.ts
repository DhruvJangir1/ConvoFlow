import { Router } from 'express';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import {  verifyAccessToken, refreshUserAccessToken, } from '../services/auth.js';
import { PRISMA_SAFE_SELECT } from '../util/constants.js';
import { prisma } from "../lib/connectionPoolClient.js";
import { clearAuthCookies } from '../services/authCookieSessions.js';
import { resolveImageUrl } from '../services/imageUpload.js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

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
  console.log('[/session] === SESSION CHECK STARTED ===');
  console.log('[/session] cookies present:', req.cookies);

  const accessToken = req.cookies.access_token;

  // Path 1: access token present — verify it and return user
  if (accessToken) {
    console.log('[/session] access_token present:', accessToken);
    console.log('[/session] attempting to verify access token...');
    try {
      const payload = verifyAccessToken(accessToken);
      console.log('[/session] access token verified, payload:', JSON.stringify(payload));

      console.log('[/session] looking up user by id:', payload.sub);
      const user = await prisma.users.findFirst({
        where: { id: payload.sub },
        select: PRISMA_SAFE_SELECT,
      });
      console.log('[/session] user lookup result:', JSON.stringify(user));

      if (!user) {
        console.log('[/session] user not found in DB, returning null');
        res.json({ user: null });
        return;
      }
      console.log('[/session] user found, returning user data');

      res.json({ user: await withSignedImageUrl(user) });
      return;
    } catch (err) {
      const isExpired = err instanceof Error && err.name === 'TokenExpiredError';
      console.log('[/session] access token verification failed, expired:', isExpired, 'error:', err instanceof Error ? err.message : err);

      if (!isExpired) {
        console.log('[/session] token is not expired (invalid), returning null');
        res.json({ user: null });
        return;
      }

      console.log('[/session] token expired, falling through to refresh...');
      const decoded = jwt.decode(accessToken) as { sub: string; email: string } | null;
      if (decoded && decoded.sub && decoded.email) {
        req.user = { id: decoded.sub, email: decoded.email };
        console.log(`[/session] extracted user ${decoded.sub} from expired token`);
      }
    }
  }

  // Path 2: no access token (or expired) — fall back to user_id + refresh_token cookies
  if (!req.user) {
    console.log('[/session] === ATTEMPTING COOKIE REFRESH ===');
    const userId = req.cookies.user_id;
    const refreshToken = req.cookies.refresh_token;

    if (!userId || !refreshToken) {
      console.log('[/session] missing user_id or refresh_token cookie, returning null');
      res.json({ user: null });
      return;
    }

    console.log('[/session] looking up user by id:', userId);
    const userRecord = await prisma.users.findFirst({
      where: { id: userId },
      select: { id: true, email: true, refresh_token_hash: true },
    });

    if (!userRecord || !userRecord.refresh_token_hash) {
      console.log('[/session] user not found or no refresh_token_hash, returning null');
      res.json({ user: null });
      return;
    }

    console.log('[/session] comparing refresh token against stored hash...');
    const tokensMatch = await bcrypt.compare(refreshToken, userRecord.refresh_token_hash);
    console.log(`[/session] bcrypt.compare result: ${tokensMatch}`);

    if (!tokensMatch) {
      console.log('[/session] refresh token does not match, returning null');
      res.json({ user: null });
      return;
    }

    console.log(`[/session] refresh token verified for user ${userRecord.id}, setting req.user`);
    req.user = { id: userRecord.id, email: userRecord.email };
  }

  // Path 3: req.user is set — rotate tokens
  console.log('[/session] === ATTEMPTING REFRESH FLOW ===');
  await refreshUserAccessToken(req, res);

  if (res.headersSent) return;

  if (!req.user) {
    console.log('[/session] refresh failed, returning null');
    res.json({ user: null });
    return;
  }

  console.log('[/session] refresh succeeded for user:', req.user.id);
  const user = await prisma.users.findFirst({
    where: { id: req.user.id },
    select: PRISMA_SAFE_SELECT,
  });

  if (!user) {
    console.log('[/session] user lookup after refresh returned null');
    res.json({ user: null });
    return;
  }

  console.log('[/session] returning user data to client');
  res.json({ user: await withSignedImageUrl(user) });
});

AuthTokenVerificationRouter.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  if (!req.cookies) {
    return;
  }

  const refreshToken = req.cookies.refresh_token;
  const refreshSalt = req.cookies.refresh_salt;

  if (!refreshToken || !refreshSalt) {
    res.status(401).json({ error: 'Refresh token missing' });
    return;
  }

  await refreshUserAccessToken(req, res);

  if (!req.user) {
    clearAuthCookies(res);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  res.json({ message: 'Tokens refreshed' });
});

export default AuthTokenVerificationRouter