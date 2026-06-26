import { AUTH_MAX_ATTEMPTS, AUTH_MAX_KEYS, AUTH_WINDOW_MS } from '../util/constants';

// In-memory rate-limit state per IP. Replace with Redis when scaling to multi-instance.
const authAttemptsRecords: Map<string, { count: number; firstSeen: number }> = new Map();

// Evict entries that have outlived the window so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of Array.from(authAttemptsRecords.entries())) {
    if (now - entry.firstSeen > AUTH_WINDOW_MS) {
      authAttemptsRecords.delete(ip);
    }
  }
}, AUTH_WINDOW_MS);

// Returns false if the IP has exceeded AUTH_MAX_ATTEMPTS within AUTH_WINDOW_MS.
// When the window expires the counter resets automatically.
export function trackAuthAttempt(ip: string): boolean {
  const now = Date.now();
  const entry = authAttemptsRecords.get(ip);

  // First visit or window expired — start a new window.
  if (!entry || now - entry.firstSeen > AUTH_WINDOW_MS) {
    // Prevent unbounded growth under heavy traffic from many distinct IPs.
    if (authAttemptsRecords.size >= AUTH_MAX_KEYS) {
      const firstKey = authAttemptsRecords.keys().next().value as string | undefined;
      if (firstKey) authAttemptsRecords.delete(firstKey);
    }
    authAttemptsRecords.set(ip, { count: 1, firstSeen: now });
    return true;
  }

  // Within the current window — increment and check limit.
  entry.count += 1;
  authAttemptsRecords.set(ip, entry);
  return entry.count <= AUTH_MAX_ATTEMPTS; // make sure that a given ip address doesnt exceed the limit 
}
