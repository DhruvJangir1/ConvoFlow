import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { TokenPayload } from '../types/authTypes.js';
import dotenv from 'dotenv';
import type { Request, Response } from 'express';
import { prisma } from '../lib/connectionPoolClient.js';
import { setAuthCookies } from './authVerificaiton.js';
import { trackAuthAttempt } from './rateLimiter.js';

dotenv.config();

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const SUPABASE_JWT_SECRET: string = process.env.SUPABASE_JWT_SECRET || (() => {
  throw new Error('SUPABASE_JWT_SECRET is not defined in environment variables');
})();


export async function checkPassword (req: Request, res: Response): Promise<void>{
  const { password } = req.body as { password?: string };
  const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';

  if (!trackAuthAttempt(ipAddress)) { // this checks if the amount of requests are less than or = to the max request limit
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

  const token = jwt.sign(payload, SUPABASE_JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  console.log(`[auth:signAccessToken] token signed for user ${id}`);
  return token;
}

export function verifyAccessToken(token: string): TokenPayload {
  const payload = jwt.verify(token, SUPABASE_JWT_SECRET, { audience: 'authenticated' }) as unknown as TokenPayload;
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
    const refreshToken = req.cookies.refresh_token;
    const refreshSalt = req.cookies.refresh_salt;

    if (!refreshToken || !refreshSalt) {
      console.log('[refreshUserAccessToken] missing refresh token or salt cookies');
      return;
    }
    console.log(`[refreshUserAccessToken] refresh token found: ${refreshToken}`);
    console.log(`[refreshUserAccessToken] refresh salt found: ${refreshSalt}`);

    const tokenHash = hashToken(refreshToken, refreshSalt);
    console.log(`[refreshUserAccessToken] token hashed with salt, hash: ${tokenHash}`);

    const user = await prisma.users.findFirst({
      where: {
        refresh_token_hash: tokenHash,
        refresh_token_expiry: { gte: new Date() },
      },
      select: { id: true, email: true },
    });

    if (!user) {
      console.log('[refreshUserAccessToken] no user found with matching refresh token');
      return;
    }
    console.log(`[refreshUserAccessToken] user found: ${user.id}`);

    const newAccessToken = signAccessToken(user.id, user.email);
    console.log(`[refreshUserAccessToken] new access token signed: ${newAccessToken}`);

    // making new new refresh token
    const { token: newRefreshToken, hash: newRefreshHash, salt: newRefreshSalt } = generateRefreshToken();
    console.log(`[refreshUserAccessToken] new refresh token: ${newRefreshToken}`);
    console.log(`[refreshUserAccessToken] new refresh salt: ${newRefreshSalt}`);
    console.log(`[refreshUserAccessToken] new refresh hash: ${newRefreshHash}`);

    await prisma.users.update({
      where: { id: user.id },
      data: {
        refresh_token_hash: newRefreshHash,
        refresh_token_expiry: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      },
    });
    console.log(`[refreshUserAccessToken] db updated with new refresh hash for user ${user.id}`);

    // set the cookies in the client's browser
    setAuthCookies(res,newAccessToken,newRefreshToken,newRefreshSalt);
    console.log('[refreshUserAccessToken] auth cookies set on response', { newAccessToken, newRefreshToken, newRefreshSalt });

    req.user = { id: user.id, email: user.email };
    console.log(`[refreshUserAccessToken] tokens rotated for user ${user.id}`);
  } catch (err) {
    console.error('[refreshUserAccessToken] error:', err);
  }
}

export function hashToken(token: string, salt?: string): string {
// If a salt is provided, use it. Otherwise, generate a proper bcrypt salt.
  const saltToUse = salt || bcrypt.genSaltSync(10);
  
  console.log(`[auth:hashToken] token hashed with ${salt ? 'provided' : 'new'} salt`);
  const hashedToken = bcrypt.hashSync(token, saltToUse);
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