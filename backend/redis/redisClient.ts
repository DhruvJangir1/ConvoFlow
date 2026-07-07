import { createClient } from 'redis';

const client = createClient()

client.on('error', (err) => console.error('[redis] Client Error:', err));
client.on('connect', () => console.log('[redis] Connected'));
client.on('reconnecting', () => console.log('[redis] Reconnecting...'));

export async function connectRedis(): Promise<void> {
  if (!client.isOpen) {
    await client.connect();
    console.log('[redis] Client connected successfully');
  } else {
    console.log('[redis] Client already connected');
  }
}

export async function disconnectRedis(): Promise<void> {
  if (client.isOpen) {
    await client.quit();
    console.log('[redis] Client disconnected');
  }
}

export { client };
export default client;
