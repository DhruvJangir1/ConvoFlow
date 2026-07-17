import { Router } from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import { hashPassword, comparePassword, signAccessToken, generateRefreshToken, hashToken, REFRESH_TOKEN_EXPIRY_MS, checkPassword } from '../services/auth.js';
import { sendUserVerificationCode,setAuthCookies } from '../services/authVerificaiton';
import { prisma } from "../lib/connectionPoolClient.js";
import { EMAIL_REGEX, } from '../util/constants';
import { setVerificationCode } from '../services/verificationStore.js';
import { clearAuthCookies } from '../services/authCookieSessions.js';
import { createNewSupabaseAuthUser, createNewSupabaseUser } from './supabaseAuth.js';
import { trackAuthAttempt } from '../services/rateLimiter.js';
import { UserResponseDTO } from '../../dtos/UserResponseDTO.js'
import { resolveImageUrl } from '../services/imageUpload.js';

dotenv.config();

const AuthEmailVerificaitonRouter = Router();

AuthEmailVerificaitonRouter.post('/check-password', async (req: Request, res: Response): Promise<void> => {
  await checkPassword(req, res);
});


AuthEmailVerificaitonRouter.post('/signup', async (req: Request, res: Response): Promise<void> => {
  const { user_name, email, password } = req.body;
  console.log('[/signup] received body:', { user_name, email, password: password ? '***' : undefined });

  if (!user_name?.trim() || !email?.trim() || !password) {
    res.status(400).json({ error: 'user_name, email, and password are required' });
    return;
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  console.log('[/signup] checking uniqueness...');

  let existingEmail;
  try {
    existingEmail = await prisma.users.findFirst({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
  } catch (e) {
    console.error('[/signup] error checking existing email:', e);
  }

  if (existingEmail) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  let existingName;
  try {
    existingName = await prisma.users.findFirst({
      where: { user_name: user_name.trim() },
      select: { id: true },
    });
  } catch (e) {
    console.error('[/signup] error checking existing username:', e);
  }

  if (existingName) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const hashedPassword = await hashPassword(password);

  const authResult = await createNewSupabaseAuthUser(
    email.trim().toLowerCase(),
    password,
    user_name.trim(),
  );

  if (!authResult.success) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { hash: refreshHash } = generateRefreshToken();

  const totalUsers = await prisma.users.count();
  const userTag = `${user_name.trim().toLowerCase()}#${String(totalUsers + 1).padStart(4, '0')}`;

  const insertPayload = {
    id: authResult.userId,
    user_name: user_name.trim(),
    email: email.trim().toLowerCase(),
    password: hashedPassword,
    refresh_token_hash: refreshHash,
    refresh_token_expiry: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    last_login: new Date(),
    is_verified: false,
    user_tag: userTag,
  };


  const newUser = await createNewSupabaseUser(req, res, authResult, insertPayload);

  if (!newUser) {
    res.status(500).json({ error: 'Failed to create user in database' });
    return;
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  setVerificationCode(newUser.id, code);

  try {
    await sendUserVerificationCode(email.trim().toLowerCase(), code);
  } catch (emailErr) {
    console.error('[/signup] failed to send verification email:', emailErr);
    res.status(500).json({ error: 'User created but failed to send verification email' });
    return;
  }

  res.status(201).json({ user: UserResponseDTO.mapUser(newUser), message: 'verification_sent' });
});

AuthEmailVerificaitonRouter.post('/login',async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  console.log(`[/login] attempt for ${email?.trim()?.toLowerCase()} from ${ipAddress}`);

  if (!email || !email.trim() || !password) {
    console.log('[/login] validation failed: missing fields');
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

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

  const user = await prisma.users.findFirst({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, user_name: true, email: true, password: true, image_url: true, is_verified: true, created_at: true, user_tag: true },
  });
  console.log(`[/login] user lookup: ${user ? 'found' : 'not found'}`);

  if (!user){
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (!user.password){
    res.status(400).json({ error: 'User has no password set' });
    return;
  }

  const dummyHash = '$2a$12$00000000000000000000000000000000000000000000';

  const passwordValid = user
    ? await comparePassword(password, user.password)
    : await comparePassword(password, dummyHash);

  if (!passwordValid) {
    console.log('[/login] authentication failed: invalid credentials');
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  console.log(`[/login] password valid for user ${user.id}`);

  const accessToken = signAccessToken(user.id, user.email);

  if (!accessToken) {
    console.error('[/login] failed to generate access token');
    res.status(500).json({ error: 'Failed to generate access token' });
    return;
  }

  const { token: refreshToken, hash: refreshHash, salt: refreshSalt } = generateRefreshToken();

  if (!refreshToken || !refreshHash || !refreshSalt) {
    console.error('[/login] failed to generate refresh token');
    res.status(500).json({ error: 'Failed to generate refresh token' });
    return;
  }

  await prisma.users.update({
    where: { id: user.id },
    data: {
      last_login: new Date(),
      refresh_token_hash: refreshHash,
      refresh_token_expiry: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    },
  });
  console.log(`[/login] user ${user.id} session updated`);

  setAuthCookies(res, accessToken, refreshToken, refreshSalt, user.id);

  const { id, user_name, email: userEmail, image_url, is_verified, created_at, user_tag } = user;

  if (!is_verified) {
    console.log(`[/login] user ${user.id} is not verified, sending verification code`);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setVerificationCode(user.id, code);
  }

  console.log(`[/login] successful login for ${userEmail}`);
  res.json({
    user: { id, user_name, email: userEmail, image_url: await resolveImageUrl(image_url), is_verified, created_at, user_tag },
  });
});

AuthEmailVerificaitonRouter.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refresh_token;
  const refreshSalt = req.cookies?.refresh_salt;
  console.log(`[/logout] refresh token present: ${refreshToken}`);

  if (refreshToken && refreshSalt) {
    const tokenHash = hashToken(refreshToken, refreshSalt);

    const result = await prisma.users.updateMany({
      where: { refresh_token_hash: tokenHash },
      data: {
        refresh_token_hash: null,
        refresh_token_expiry: null
      },
    });
    console.log(`[/logout] invalidated ${result.count} tokens`);
  }

  clearAuthCookies(res);
  console.log('[/logout] cookies cleared');
  res.json({ message: 'Logged out' });
});


export default AuthEmailVerificaitonRouter