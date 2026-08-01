export const PRISMA_SAFE_SELECT = {
  id: true,
  user_name: true,
  email: true,
  created_at: true,
  image_url: true,
  is_verified: true,
  last_login: true,
  user_tag: true,
  bio: true,
};

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FRIEND_MAX_PENDING_OUTGOING = 10;
export const FRIEND_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export const WS_TICKET_TTL_MS = 60 * 1000; // 60 seconds
