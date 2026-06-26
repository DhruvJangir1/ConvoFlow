import { Router } from 'express';
import type { Request, Response } from 'express';
import {  verifyAccessToken, refreshUserAccessToken, } from '../services/auth.js';
import { PRISMA_SAFE_SELECT } from '../util/constants.js';
import { prisma } from "../lib/connectionPoolClient.js";
import { clearAuthCookies } from '../services/authCookieSessions.js';
import dotenv from 'dotenv';

dotenv.config();

const AuthTokenVerificaitonRouter = Router();

AuthTokenVerificaitonRouter.get('/session', async (req: Request, res: Response): Promise<void> => {
  if (!req.cookies) {
    return;
  }
  console.log('[/session] === SESSION CHECK STARTED ===');
  console.log('[/session] cookies present:', req.cookies);
  console.log('[/session] headers:', JSON.stringify(req.headers));

  const accessToken = req.cookies?.access_token;  
  console.log('[/session] access_token present:', accessToken);

  if (accessToken) {
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
      res.json({ user });
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
    }
  }

  console.log('[/session] === ATTEMPTING REFRESH FLOW ===');

  await refreshUserAccessToken(req, res);

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
  res.json({ user });
});



AuthTokenVerificaitonRouter.post('/refresh', async (req: Request, res: Response): Promise<void> => {
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

export default AuthTokenVerificaitonRouter