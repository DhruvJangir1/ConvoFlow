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

const memoryAttempts = new Map<string, number[]>();
const memoryBlocks = new Map<string, number>();

function memoryRateLimit(ip: string): boolean {
  const now = Date.now();
  const blockExpiry = memoryBlocks.get(ip);
  if (blockExpiry && blockExpiry > now) {
    console.log(`[rateLimiter-memory] Request blocked for ${ip} — still in block period`);
    return false;
  }
  memoryBlocks.delete(ip);

  const timestamps = (memoryAttempts.get(ip) || []).filter(t => t > now - WINDOW_MS);
  if (timestamps.length >= MAX_ATTEMPTS) {
    console.log(`[rateLimiter-memory] ${ip} exceeded ${MAX_ATTEMPTS} attempts — blocking for 5 min`);
    memoryBlocks.set(ip, now + BLOCK_SECONDS * 1000);
    memoryAttempts.delete(ip);
    return false;
  }

  timestamps.push(now);
  memoryAttempts.set(ip, timestamps);
  console.log(`[rateLimiter-memory] ${ip} — attempt ${timestamps.length}/${MAX_ATTEMPTS} recorded`);
  return true;
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
      await client.set(blKey, '1', { ex: BLOCK_SECONDS });
      await client.del(rlKey);
      return false;
    }

    await client.zAdd(rlKey, { score: now, value: String(now) });
    await client.expire(rlKey, KEY_TTL_SECONDS);

    console.log(`[rateLimiter] ${ip} — attempt ${attemptCount + 1}/${MAX_ATTEMPTS} recorded`);
    return true;

  } catch (err) {
    console.error(`[rateLimiter] Redis error for IP ${ip} — falling back to memory:`, err.message);
    return memoryRateLimit(ip);
  }
}
