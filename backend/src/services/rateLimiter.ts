import { client } from '../../redis/redisClient.js';

const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 10;
const BLOCK_SECONDS = 300;
const KEY_TTL_SECONDS = 600;

function rateLimitKey(ip: string): string {
  return `rate_limit:${ip}`;
}

function blockKey(ip: string): string {
  return `rate_limit:blocked:${ip}`;
}

export async function trackAuthAttempt(ip: string): Promise<boolean> {
  const now = Date.now();
  const rlKey = rateLimitKey(ip);
  const blKey = blockKey(ip);

  try {
    const isBlocked = await client.get(blKey);
    if (isBlocked) {
      console.log(`[rateLimiter] Request blocked for ${ip} — still in block period`);
      return false;
    }

    await client.zRemRangeByScore(rlKey, 0, now - WINDOW_MS);

    const attemptCount = await client.zCard(rlKey);

    if (attemptCount >= MAX_ATTEMPTS) {
      console.log(`[rateLimiter] ${ip} exceeded ${MAX_ATTEMPTS} attempts in 1 min — blocking for 5 min`);
      await client.set(blKey, '1', { EX: BLOCK_SECONDS });
      await client.del(rlKey);
      return false;
    }

    await client.zAdd(rlKey, { score: now, value: String(now) });
    await client.expire(rlKey, KEY_TTL_SECONDS);

    console.log(`[rateLimiter] ${ip} — attempt ${attemptCount + 1}/${MAX_ATTEMPTS} recorded`);
    return true;

  } catch (err) {
    console.error(`[rateLimiter] Redis error for IP ${ip}:`, err);
    return false;
  }
}
