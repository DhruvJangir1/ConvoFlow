export const PRISMA_SAFE_SELECT = {
  id: true,
  user_name: true,
  email: true,
  created_at: true,
  image_url: true,
  is_verified: true,
  last_login: true,
  user_tag: true,
};

export const VERIFICATION_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FRIEND_MAX_PENDING_OUTGOING = 10;
export const FRIEND_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
