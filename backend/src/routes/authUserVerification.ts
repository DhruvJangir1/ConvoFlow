import { Router } from 'express';
import type { Request, Response } from 'express';
import {  signAccessToken, generateRefreshToken, REFRESH_TOKEN_EXPIRY_MS } from '../services/auth.js';
import { sendUserVerificationCode, setAuthCookies } from '../services/authVerificaiton.js';
import { setVerificationCode, findUserIdByCode, deleteVerificationCode } from '../services/verificationStore.js';
import { prisma } from "../lib/connectionPoolClient.js";
import { PRISMA_SAFE_SELECT } from '../util/constants';

const authUserVerification = Router();

authUserVerification.post('/verify', async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body as { code?: string };
  console.log(`[/verify] verification attempt received`);

  if (!code) {
    console.log('[/verify] no code provided');
    res.status(400).json({ error: 'code is required' });
    return;
  }

  // Find the user_id that matches this code
  const foundUserId = findUserIdByCode(code);

  if (!foundUserId) {
    console.log('[/verify] invalid or expired code');
    res.status(400).json({ error: 'Invalid or expired verification code' });
    return;
  }
  console.log(`[/verify] code matched user ${foundUserId}`);

  // Mark user as verified in DB
  let updatedUser;

  try {
    updatedUser = await prisma.users.update({
      where: { id: foundUserId },
      data: { is_verified: true },
      select: PRISMA_SAFE_SELECT,
    });
    console.log(`[/verify] user ${foundUserId} marked verified`);
  } catch (e) {
    console.error(`[/verify] failed to update user ${foundUserId}:`, e);
    res.status(500).json({ error: 'Failed to mark user verified' });
    return;
  }

  // Issue tokens now that verification succeeded
  const accessToken = signAccessToken(updatedUser.id, updatedUser.email);
  const { token: refreshToken, hash: refreshHash, salt: refreshSalt } = generateRefreshToken();

  await prisma.users.update({
    where: { id: updatedUser.id },
    data: {
      refresh_token_hash: refreshHash,
      refresh_token_expiry: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    },
  });
  console.log(`[/verify] tokens issued for user ${foundUserId}`);

  // set new user's tokens in cookies
  setAuthCookies(res, accessToken, refreshToken, refreshSalt, foundUserId);

  // Remove verification entry
  deleteVerificationCode(foundUserId);

  res.json({ user: updatedUser });
});



// Resend verification code endpoint: accepts { email }
authUserVerification.post('/resend-verification', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };
  console.log(`[/resend-verification] request for ${email}`);
  if (!email) {
    console.log('[/resend-verification] no email provided');
    res.status(400).json({ error: 'email is required' });
    return;
  }

  const user = await prisma.users.findFirst({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, is_verified: true },
  });

  if (!user) {
    console.log('[/resend-verification] user not found');
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (user.is_verified) {
    console.log('[/resend-verification] user already verified');
    res.status(400).json({ error: 'User already verified' });
    return;
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  setVerificationCode(user.id, code);
  console.log(`[/resend-verification] new code generated for user ${user.id}`);

  try {
    await sendUserVerificationCode(email.trim().toLowerCase(), code);
    console.log(`[/resend-verification] email sent to ${email}`);
  } catch (e) {
    console.error('[/resend-verification] failed to send:', e);
    res.status(500).json({ error: 'Failed to send verification email' });
    return;
  }

  res.json({ message: 'verification_sent' });
});


export default authUserVerification