import bcrypt, { hashSync } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { TokenPayload } from '../types/authTypes.js';
import dotenv from 'dotenv';
import type { Request, Response } from 'express';
import { prisma } from '../lib/connectionPoolClient.js';
import { setAuthCookies } from './authVerificaiton.js';
import { trackAuthAttempt } from './rateLimiter.js';
import { client as redis } from '../../redis/redisClient.js';

dotenv.config();

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';

function getJwtSecret(): string {
  const secret = process.env.SUPABASE_JWT_SECRET || "";
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET is not defined in environment variables');
  }
  return secret;
}

export async function checkPassword (req: Request, res: Response): Promise<void>{
  const { password } = req.body as { password?: string };
  const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';

  if (!await trackAuthAttempt(ipAddress)) {
    res.status(429).json({ error: 'Too many requests, please try again later' });
    return;
  }
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'password is required' });
    return;
  }
  if (password.length < 8) {
    res.json({ pwned: false, count: 0, strength: 'weak', message: 'Password must be at least 8 characters' });
    return;
  }

  try {
    const pwnCount = await queryPwnedCount(password);
    if (pwnCount > 0) {
      console.warn('[/signup] rejected pwned password');
      res.status(400).json({ error: 'Password appears in a known breach; choose a different password' });
      return;
    }
  } catch (e) {
    console.error('[/signup] HIBP check failed, allowing signup to proceed:', e);
  }

  const strength = password.length >= 12 ? 'strong' : 'weak';
  res.json({ pwned: false, count: 0, strength });
}

export function signAccessToken(id: string, email: string): string {
  const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
    sub: id,
    email,
    aud: 'authenticated',
  };

  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
  console.log(`[auth:signAccessToken] token signed for user ${id}`);
  return token;
}

export function verifyAccessToken(token: string): TokenPayload {
  const payload = jwt.verify(token, getJwtSecret(), { audience: 'authenticated' }) as unknown as TokenPayload;
  console.log(`[auth:verifyAccessToken] token verified for user ${payload.sub}`);
  return payload;
}

export async function hashPassword(password: string): Promise<string> {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  console.log('[auth:hashPassword] password hashed successfully');
  return hash;
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const result = await bcrypt.compare(password, hash);
  console.log(`[auth:comparePassword] password match: ${result}`);
  return result;
}


export function generateRefreshToken(): { token: string; hash: string; salt: string } {
  const token = crypto.randomBytes(32).toString('hex'); 
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(token, salt);
  return { token, hash, salt };
}

export async function refreshUserAccessToken(req: Request, res: Response): Promise<void>  {
  try {
    if (!req.user) {
      console.log('[refreshUserAccessToken] no req.user, returning 401');
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    // check user's details
    const refreshToken = req.cookies.refresh_token;
    const userId = req.user.id;

    if (!refreshToken || typeof refreshToken !== 'string') {
      console.log('[refreshUserAccessToken] missing refresh token cookie');
      res.status(401).json({ error: 'Refresh token missing' });
      return;
    }
    console.log(`[refreshUserAccessToken] refresh token found for user ${userId}`);

    // make sure that user exists
    const userRecord = await prisma.users.findFirst({
      where: { id: userId },
      select: { id: true, email: true, refresh_token_hash: true, refresh_token_expiry: true },
    });

    if (!userRecord || !userRecord.refresh_token_hash) {
      console.log('[refreshUserAccessToken] no user or no stored hash found');
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    if (userRecord.refresh_token_expiry && userRecord.refresh_token_expiry < new Date()) {
      console.log('[refreshUserAccessToken] refresh token expired');
      res.status(401).json({ error: 'Refresh token expired' });
      return;
    }

    console.log('[refreshUserAccessToken] user record found')

    const refreshTokensMatch = await bcrypt.compare(refreshToken, userRecord.refresh_token_hash);
    console.log(`[refreshUserAccessToken] bcrypt.compare result: ${refreshTokensMatch}`);

    if (!refreshTokensMatch) {
      console.log('[refreshUserAccessToken] refresh token does not match stored hash');
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const newAccessToken = signAccessToken(userRecord.id, userRecord.email);
    console.log(`[refreshUserAccessToken] new access token signed for user ${userRecord.id}`);

    const { token: newRefreshToken, hash: newRefreshHash, salt: newRefreshSalt } = generateRefreshToken();
    console.log(`[refreshUserAccessToken] new refresh token generated`);

    await prisma.users.update({
      where: { id: userRecord.id },
      data: {
        refresh_token_hash: newRefreshHash,
        refresh_token_expiry: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      },
    });
    console.log(`[refreshUserAccessToken] db updated with new refresh hash for user ${userRecord.id}`);

    await redis.set(`used_token:${userRecord.refresh_token_hash}`, userRecord.id, { EX: Math.ceil(REFRESH_TOKEN_EXPIRY_MS / 1000) });
    console.log('[refreshUserAccessToken] old token hash stored in Redis for replay detection');

    setAuthCookies(res, newAccessToken, newRefreshToken, newRefreshSalt, userRecord.id);
    console.log('[refreshUserAccessToken] auth cookies set on response');

    req.user = { id: userRecord.id, email: userRecord.email };
    console.log(`[refreshUserAccessToken] tokens rotated for user ${userRecord.id}`);
  } catch (err) {
    console.error('[refreshUserAccessToken] error:', err);
    res.status(401).json({ error: 'Refresh failed' });
  }
}

export function hashToken(token: string, salt: string): string {
// If a salt is provided, use it. Otherwise, generate a proper bcrypt salt.
  const saltToUse = salt 
  
  console.log(`[auth:hashToken] token hashed with ${salt ? 'provided' : 'new'} salt`);
  const hashedToken = bcrypt.hashSync(token, saltToUse);
  console.log(`${hashedToken ? 'hashedToken exits' : 'hashedToken doesnt exist'}`)
  return hashedToken;
}

// Helper: query HIBP pwned passwords using k-Anonymity
export async function queryPwnedCount(password: string): Promise<number> {
  try {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const resp = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { 'User-Agent': 'ConvoFlow/1.0' } });
    if (!resp.ok) return -1;
    const text = await resp.text();
    for (const line of text.split(/\r?\n/)) {
      const [hashSuffix, countStr] = line.split(':');
      if (!hashSuffix) continue;
      if (hashSuffix.trim().toUpperCase() === suffix) return parseInt(countStr ?? '0', 10) || 0;
    }
    return 0;
  } catch (e) {
    console.error('[/check-password] error querying HIBP:', e);
    return -1;
  }
}

export const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 1 month