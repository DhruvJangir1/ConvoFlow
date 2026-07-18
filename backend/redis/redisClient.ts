import { Redis } from '@upstash/redis';

export const client = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function connectRedis(): Promise<void> {
  try {
    await client.ping();
    console.log('[redis] Connected successfully');
  } catch (err) {
    console.error('[redis] Connection failed:', err);
    throw err;
  }
}

export async function disconnectRedis(): Promise<void> {
  console.log('[redis] No persistent connection to close (REST-based)');
}

export default client;
