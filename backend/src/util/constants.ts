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


// Cookie options: SameSite=None in production (requires secure=true), Lax in development.
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};


export const AUTH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
export const AUTH_MAX_ATTEMPTS = 10;
export const AUTH_MAX_KEYS = 5000; // cap map size to avoid memory OOM
export const VERIFICATION_TTL_MS = 15 * 60 * 1000; // 15 minutes


export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FRIEND_MAX_PENDING_OUTGOING = 10;
export const FRIEND_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
