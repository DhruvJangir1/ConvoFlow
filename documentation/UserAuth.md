# High-Level Architecture
```
[Client Browser] <--> [Express Server] <--> [Supabase Auth (auth.users)]
                        |
                   [Prisma ORM] <--> [PostgreSQL (public.USERS)]
                        |
                 [Resend (Email)]
```

**Stack**: Node.js + Express, Supabase Auth (user management), Prisma + PostgreSQL (app-level user data), Resend (email verification), JWT + opaque refresh tokens (session management).

---

# Token Strategy

| Token | Type | Storage | Lifetime | Revocable |
|-------|------|---------|----------|-----------|
| **Access Token** | JWT (signed with `SUPABASE_JWT_SECRET`, aud: `authenticated`) | `httpOnly` cookie (`access_token`) | 15 minutes | No (stateless) |
| **Refresh Token** | Opaque random 64-char hex | `httpOnly` cookie (`refresh_token`) | 30 days | Yes (stored as bcrypt hash in DB) |
| **Refresh Salt** | Plaintext salt for bcrypt | `httpOnly` cookie (`refresh_salt`) | 30 days | — |

**Rotation**: Every time a refresh token is used, it is rotated — the old hash is replaced with a new one in the DB.

**Replay Detection**: On successful rotation, the old token hash is stored in Redis as `used_token:<hash>` → `userId` with a 30-day TTL. If a subsequent refresh attempt hashes to a value not found in the DB *but* the hash exists in Redis, the token was already rotated by someone else → **replay attack detected**. The user's `refresh_token_hash` is nullified and all cookies are cleared, forcing re-login. This prevents an attacker who stole a refresh token from using it after the legitimate user rotates it.

---

# Authentication Mechanics

## [Scenario A] Signup

1. User submits `{ user_name, email, password }` to `POST /auth/EmailVerificaitonRouter/signup`.
2. **Validate input**: email format, all fields required.
3. **Check password strength**: frontend calls `POST /auth/EmailVerificaitonRouter/check-password` which checks length (>= 8 chars) and queries **HIBP** (k-Anonymity) for known breaches.
4. **Check uniqueness**: Prisma queries `public.USERS` for duplicate email or username.
5. **Hash password** with bcrypt (12 rounds) via `auth.ts:hashPassword()`.
6. **Create Supabase auth user** via `supabase.auth.admin.createUser()` — this creates a record in `auth.users`.
7. **Pre-generate a refresh token hash** (discarding the actual token and salt) and store in the `public.USERS` row. No tokens are issued to the client yet.
8. **Create app user** in `public.USERS` table via Prisma (`supabaseAuth.ts:createNewSupabaseUser()`). If this fails, the Supabase auth user is **rolled back** (deleted) to avoid orphaned accounts.
9. **Generate 6-digit verification code**, store in in-memory `Map` with a 15-minute TTL.
10. **Send verification email** via Resend (`authVerificaiton.ts:sendUserVerificationCode()`).
11. Respond with `{ user, message: 'verification_sent' }` — **no auth cookies are set**. The user is registered but not yet authorized.

## [Scenario B] Email Verification

1. User submits `{ code }` to `POST /auth/UserVerificaitonRouter/verify`.
2. Look up the code in the in-memory store (`verificationStore.ts:findUserIdByCode()`):
   - Codes are stored as `Map<userId, { code, expiresAt }>` with a **15-minute TTL** (`VERIFICATION_TTL_MS`).
   - `findUserIdByCode()` iterates all entries; returns the userId only if the code matches AND `expiresAt >= now`.
3. **If the code is invalid or expired**: return `400 { error: 'Invalid or expired verification code' }`. The user can request a resend via `POST /auth/UserVerificaitonRouter/resend-verification`.
4. **If the code is valid**: mark `public.USERS.is_verified = true`.
5. **Issue tokens**: generate a new access JWT + refresh token pair, update refresh hash in DB.
6. **Set cookies** via `setAuthCookies()`.
7. **Delete verification code** from the store.
8. Respond with `{ user }` — the user is now fully authenticated.

> Codes are unique but not tied to a specific userId in a 1:1 mapping. On lookup, the entire map is scanned. Expired entries are purged by a periodic cleanup interval running every 15 minutes.

- Currently, no rate limiting is implemented here.

## [Scenario C] Login

1. User submits `{ email, password }` to `POST /auth/EmailVerificaitonRouter/login`.
2. **Validate input**: email + password required.
3. **Rate limit check**: `trackAuthAttempt(ipAddress)` — allows 10 attempts per 1-minute window per IP.
4. **Validate password length**: >= 8 chars.
5. **Lookup user** in `public.USERS` by email. Returns 404 if not found.
6. **Compare password** with bcrypt (`comparePassword()`). A constant-time dummy hash is used if the user exists but has no password set (e.g. OAuth-only account).
7. **Issue tokens**: sign new access JWT, generate new refresh token + salt, update refresh hash in DB.
8. **Set cookies** via `setAuthCookies(res, accessToken, refreshToken, refreshSalt, userId)`.
9. If user is **not verified**, generate a verification code and store it (client can trigger resend from login screen).
10. Respond with `{ user }`.

- **The Goal** = to have the user never have to come to the log in page, unless if he logged out purposefully.
- So if a user who signed up, should not have to go to the login page cuz his refresh/access token expired.

## [Scenario D] Authenticated Request (Middleware)

`middleware/authenticate.ts` — used by all protected API routes (notifications, friends, chats, profile, etc.).

1. Request hits `middleware/authenticate.ts`.
2. Check `req.cookies` exists — if not, return 401.
3. Check for `access_token` cookie:
   - **Present + valid JWT**: attach `req.user = { id, email }` and call `next()`.
   - **Present but expired**: extract `sub`/`email` from the JWT payload → set `req.user` → attempt refresh (step 4). If refresh succeeds, call `next()`. If fails, return 401 with `X-Token-Expired: true` header.
   - **Missing**: attempt refresh (step 4). If refresh succeeds, call `next()`. If fails, return 401.
4. **Refresh flow** (`auth.ts:refreshUserAccessToken(req, res)`):
   - Requires `req.user` to be set (either from valid token or decoded expired token).
   - Read `refresh_token` cookie.
   - Look up `public.USERS` by `req.user.id`.
   - If user not found or no `refresh_token_hash`: return 401.
   - If `refresh_token_expiry` is past: return 401.
   - Compare `refresh_token` against stored hash with bcrypt.
   - If match: sign a **new access JWT**, generate a **new refresh token** (rotation), update DB, store old hash in Redis for replay detection, set new cookies, attach `req.user`.
   - If no match: return without setting `req.user` — middleware then returns 401.

## [Scenario E] Session Check

`GET /auth/TokenVerificationRouter/session` — called on page load to hydrate client-side auth state:
1. If `access_token` exists and is valid → look up user in DB → return `{ user }`.
2. If `access_token` is present but expired → extract `sub`/`email` from the JWT payload → set `req.user` → fall through to refresh.
3. If no access token (or expired) → read `user_id` + `refresh_token` cookies → look up user by `user_id` → compare refresh token against stored hash → if match, set `req.user`.
4. If `req.user` is set → call `refreshUserAccessToken()` to rotate tokens → look up user → return `{ user }`.
5. If all fail → return `{ user: null }` (client treats this as logged-out state).

## [Scenario F] Logout

`POST /auth/EmailVerificaitonRouter/logout`:
1. Hash the `refresh_token` from cookies with `refresh_salt`.
2. `updateMany` where hash matches → set `refresh_token_hash = null, refresh_token_expiry = null`.
3. Clear all four auth cookies (`access_token`, `refresh_token`, `refresh_salt`, `user_id`).
4. Respond with `{ message: 'Logged out' }`.

---

# Rate Limiting

**File**: `services/rateLimiter.ts`

- **Window**: 1 minute (sliding window via Redis sorted set).
- **Max attempts**: 10 per minute per IP.
- **Block duration**: 5 minutes once the limit is exceeded.
- **Storage**: Redis sorted set (`rate_limit:<ip>`) + block key (`rate_limit:blocked:<ip>`).
- **TTL**: 10 minutes on each sorted set key (auto-cleanup).
- **Fail-closed**: if Redis is unreachable, requests are rejected.

Applied on:
- `POST /check-password`
- `POST /login`

> **Migration complete**: In-memory `Map` replaced with Redis sorted sets for multi-instance compatibility.

---

# Cookie Configuration

**File**: `util/constants.ts` (shared `COOKIE_OPTIONS`)

```ts
COOKIE_OPTIONS = {
  httpOnly: true,       // not accessible via JS (XSS mitigation)
  secure: true,         // HTTPS only
  sameSite: 'lax',      // CSRF mitigation
  path: '/',
}
```

**`setAuthCookies`** is defined in two places with identical signatures (`res, accessToken, refreshToken, refreshSalt, userId`):
- `services/authVerificaiton.ts` — primary, used by signup/verify/login flows
- `services/authCookieSessions.ts` — used internally by the refresh flow

Both set the same 4 cookies. `clearAuthCookies` (`services/authCookieSessions.ts`) clears all 4.

| Cookie | Max Age |
|--------|---------|
| `access_token` | 15 minutes |
| `refresh_token` | 30 days |
| `refresh_salt` | 30 days |
| `user_id` | 30 days |

---

# Database Schema (public.USERS)

**File**: `prisma/schema.prisma`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Matches `auth.users.id` — 1:1 relation |
| `user_name` | String | Unique |
| `email` | String | Unique |
| `password` | String? | bcrypt hash |
| `user_tag` | String | `username#0001` format |
| `refresh_token_hash` | String? | bcrypt hash of the current refresh token |
| `refresh_token_expiry` | DateTime? | Expiration of the refresh token |
| `is_verified` | Boolean | Email verification status |
| `image_url` | String? | Profile picture |
| `bio` | String? | User bio |
| `role` | String | `"user"` by default |
| `last_login` | DateTime | |
| `created_at` | DateTime | |

---

# API Routes Summary

| Route | Method | Purpose |
|-------|--------|---------|
| `/auth/EmailVerificaitonRouter/check-password` | POST | Validate password strength + HIBP check |
| `/auth/EmailVerificaitonRouter/signup` | POST | Create account + send verification email |
| `/auth/EmailVerificaitonRouter/login` | POST | Authenticate + issue tokens |
| `/auth/EmailVerificaitonRouter/logout` | POST | Invalidate refresh token + clear cookies |
| `/auth/UserVerificaitonRouter/verify` | POST | Verify email with 6-digit code |
| `/auth/UserVerificaitonRouter/resend-verification` | POST | Resend verification code |
| `/auth/TokenVerificationRouter/session` | GET | Hydrate client-side auth state |
| `/auth/TokenVerificationRouter/refresh` | POST | Explicit token refresh |
| `/auth/WsTicketRouter/ws-ticket` | GET | Generate one-time WebSocket auth ticket (requires valid access token) |

---

# Edge Cases & Mitigations

| Concern | Mitigation |
|---------|------------|
| **Stolen access token** | Short expiry (15 min). No sensitive data in JWT payload. Token bound to audience `authenticated`. |
| **Stolen refresh token** | Rotation on every use — old token invalidated. Hash stored in DB (not plaintext). 30-day expiry window. |
| **Brute force login** | Rate limiting per IP (10 attempts / 1 min). bcrypt (slow). Constant-time dummy hash for users with no password set. |
| **Token replay** | Refresh token rotation invalidates previous tokens. Access tokens are short-lived. |
| **XSS stealing cookies** | All cookies are `httpOnly` + `secure` + `sameSite: lax`. No token accessible via JS. |
| **CSRF** | `sameSite: lax` prevents cross-site form submissions. Consider CSRF tokens for state-changing ops. |
| **Orphaned Supabase auth users** | Rollback: if Prisma insert fails, the new Supabase auth user is deleted. |
| **Expired verification code** | In-memory TTL of 15 min. User can request resend. |
| **User enumeration** | Login returns same error for non-existent user and wrong password. Constant-time bcrypt compare. |
| **In-memory state loss on restart** | Rate limiter now uses Redis (persists across restarts). Verification codes remain in-memory (15-min TTL). |

---

# Security Guardrails

- **Helmet**: HTTP security headers (CSP, HSTS, frameguard, noSniff, etc.).
- **CORS**: Configured origin restrictions, enforced Origin/Referer validation on state-changing methods.
- **httpOnly cookies**: Tokens inaccessible to JS.
- **bcrypt**: Password hashing (12 rounds) + refresh token hashing (10 rounds).
- **JWT verification**: Audience (`authenticated`) + secret checked on every verify.
- **Rate limiting**: IP-based throttling on auth endpoints (Redis-backed sliding window).
- **HIBP integration**: Reject known compromised passwords at signup.
- **`authenticate` middleware**: All protected routes (notifications, friends, chats, profile) go through `middleware/authenticate.ts` which verifies JWT or refreshes via cookie-based session.
- **Chat membership checks**: All message CRUD endpoints verify user is a member of the target chat.
- **XSS prevention**: All user message content is HTML-escaped before storage (`escapeHtml` on every write path).
- **Refresh token replay detection**: Old token hashes stored in Redis; replayed tokens detected and invalidated.
- **Redis authentication**: `REDIS_URL` and `REDIS_PASSWORD` env vars supported; defaults to `redis://localhost:6379`.
- **Environment variables**: `SUPABASE_JWT_SECRET`, `SUPA_BASE_URL`, `SUPA_BASE_ANON_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `REDIS_URL`, `REDIS_PASSWORD` stored in `.env`.

---

# Features to Add

## High Priority
- [x] **Redis-backed rate limiting** — in-memory `Map` replaced with Redis sorted sets (rateLimiter.ts)
- [ ] **Account deletion endpoint** — cascade-delete from `auth.users` + `public.USERS`
- [ ] **Password reset flow** — forgot password → email reset link → set new password
- [ ] **MFA (TOTP)** — Supabase already supports it via `mfa_factors` table; wire up QR enrollment and verification
- [ ] **OAuth providers (Google, GitHub, Discord)** — Supabase supports these natively; need frontend + backend integration

## Medium Priority
- [ ] **Session management dashboard** — allow users to view and revoke active sessions
- [ ] **Device fingerprinting** — bind tokens to `user-agent` + IP to detect token theft
- [ ] **Email change flow** — verified email change with confirmation sent to both old and new addresses
- [ ] **Suspicious activity alerts** — notify user on login from new IP/device
- [ ] **CSRF token implementation** — add CSRF protection for state-changing operations beyond what `sameSite` provides

## Low Priority / Nice-to-Have
- [ ] **Passkeys / WebAuthn** — passwordless login via biometrics or hardware keys (Supabase already has `webauthn_credentials` table)
- [ ] **Remember-me toggle** — extend refresh token lifetime (e.g., 90 days) vs. default 30 days
- [ ] **Audit logging** — log auth events (login, logout, failed attempts) to a separate audit table
- [ ] **Account lockout** — after N consecutive failed attempts, lock account for a cooldown period (beyond IP-level rate limiting)
- [x] **Refresh token family tree** — Redis-backed replay detection flags rotated token reuse and invalidates all sessions
- [ ] **Magic link login** — passwordless email login via one-time tokens (Supabase supports this)
- [ ] **Social login linking** — allow users to link multiple OAuth providers to the same account
- [ ] **Rate limit by userId + IP** — combine userId-level and IP-level rate limiting for more granular control
 


---