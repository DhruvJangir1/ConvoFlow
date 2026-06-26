import { VERIFICATION_TTL_MS } from '../util/constants.js';

interface VerificationEntry {
  code: string;
  expiresAt: number;
}

const verificationCodes: Map<string, VerificationEntry> = new Map();

// Evict expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of Array.from(verificationCodes.entries())) {
    if (entry.expiresAt <= now) verificationCodes.delete(userId);
  }
}, VERIFICATION_TTL_MS);

export function setVerificationCode(userId: string, code: string): void {
  verificationCodes.set(userId, { code, expiresAt: Date.now() + VERIFICATION_TTL_MS });
}

export function findUserIdByCode(code: string): string | null {
  const now = Date.now();
  for (const [userId, entry] of verificationCodes.entries()) {
    if (entry.code === code && entry.expiresAt >= now) return userId;
  }
  return null;
}

export function deleteVerificationCode(userId: string): void {
  verificationCodes.delete(userId);
}
