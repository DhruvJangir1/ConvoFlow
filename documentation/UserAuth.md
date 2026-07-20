# High-Level Architecture
```
[Client Browser] <--> [Express Server] <--> [Supabase Auth (auth.users)]
                        |
                   [Prisma ORM] <--> [PostgreSQL (public.USERS)]
                        |
                   [Gmail SMTP]
```

**Stack**: Node.js + Express, Supabase Auth (user management), Prisma + PostgreSQL (app-level user data), Gmail SMTP via Nodemailer (email verification), JWT + opaque refresh tokens (session management).

---

# Token Strategy

| Token | Type | Storage | Lifetime | Revocable |
|-------|------|---------|----------|-----------|
| **Access Token** | JWT (signed with `SUPABASE_JWT_SECRET`, aud: `authenticated`) | `httpOnly` cookie (`access_token`) | 15 minutes | No (stateless) |
| **Refresh Token** | Opaque random 64-char hex | `httpOnly` cookie (`refresh_token`) | 30 days | Yes (stored as bcrypt hash in DB) |
| **Refresh Salt** | Plaintext salt for bcrypt | `httpOnly` cookie (`refresh_salt`) | 30 days | — |

**Rotation**: Every time a refresh token is used, it is rotated — the old hash is replaced with a new one in the DB.

**Race Condition Prevention**: `rotateRefreshTokenWithLock()` in `auth.ts` uses a per-user `Map<string, Promise>`. When a rotation starts for a userId, subsequent requests for the same userId receive the same in-flight promise instead of starting a second rotation. All three rotation sites use this locked version:
- `authenticate` middleware (every protected API request)
- `GET /session` (page load / background refresh)
- `POST /refresh` (explicit refresh)

**Replay Detection**: On successful rotation, the old token hash is stored in Redis as `used_token:<hash>` → `userId` with a 30-day TTL. This operation is wrapped in try-catch and is non-fatal — if Redis is unavailable, rotation still succeeds. If a subsequent refresh attempt hashes to a value not found in the DB *but* the hash exists in Redis, the token was already rotated by someone else → **replay attack detected**. The user's `refresh_token_hash` is nullified and all cookies are cleared, forcing re-login.

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
10. **Send verification email** via Gmail SMTP (`authVerificaiton.ts:sendUserVerificationCode()`).
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

> Codes are stored as a `Map<userId, { code, expiresAt }>`, so each code is tied to a specific userId in a 1:1 mapping. The lookup function (`findUserIdByCode`) searches by code (reverse direction), requiring a full map scan. Expired entries are purged by a periodic cleanup interval running every 15 minutes.

- Currently, no rate limiting is implemented here.

## [Scenario C] Login

1. User submits `{ email, password }` to `POST /auth/EmailVerificaitonRouter/login`.
2. **Validate input**: email + password required.
3. **Rate limit check**: `trackAuthAttempt(ipAddress)` — allows 10 attempts per 1-minute window per IP.
4. **Validate password length**: >= 8 chars.
5. **Lookup user** in `public.USERS` by email. Returns 404 if not found.
6. **Compare password** with bcrypt (`comparePassword()`). If the user has no password set (e.g. OAuth-only account), the request is rejected early with a `400` before comparison.
7. **Issue tokens**: sign new access JWT, generate new refresh token + salt, update refresh hash in DB.
8. **Set cookies** via `setAuthCookies(res, accessToken, refreshToken, refreshSalt, userId)`.
9. If user is **not verified**, generate a verification code and store it (client can trigger resend from login screen).
10. Respond with `{ user, accessTokenExpiresAt: Date.now() + 15 * 60 * 1000 }`.

- **The Goal** = to have the user never have to come to the log in page, unless if he logged out purposefully.
- So if a user who signed up, should not have to go to the login page cuz his refresh/access token expired.

## [Scenario D] Authenticated Request (Middleware)

`middleware/authenticate.ts` — used by all protected API routes (notifications, friends, chats, profile, etc.).

1. Request hits `middleware/authenticate.ts`.
2. Check `req.cookies` exists — if not, return 401.
3. Check for `access_token` cookie:
   - **Present + valid JWT**: attach `req.user = { id, email }` and call `next()`.
   - **Present but expired**: decode payload → re-sign new access token → set cookie with fresh maxAge → attach `req.user` → call `next()`.
   - **Invalid JWT** (not expired, just invalid): return 401 "Invalid access token".
4. If no access_token cookie (or no cookies at all):
   - Read `user_id` + `refresh_token` cookies.
   - If missing → return 401 "Authentication required".
   - Call `rotateRefreshTokenWithLock(userId, refreshToken)`.
   - If success → `setAuthCookies()` → set `req.user` → `next()`.
   - If failure → return 401 "Session expired".

**Key detail**: The `authenticate` middleware performs refresh token rotation (with the locked version) on every request that lacks a valid access token. This means mid-session API calls (e.g., fetching chat list) automatically refresh expired tokens without the client needing to handle it.

## [Scenario E] Session Check

`GET /auth/TokenVerificationRouter/session` — called on page load and periodically via background timer:

1. If `access_token` exists and is valid → look up user in DB → **re-set cookie with fresh maxAge** (prevents expiry gap between background refresh cycles) → return `{ user, accessTokenExpiresAt }`.
2. If `access_token` is present but expired → decode payload → re-sign new access token → set cookie → set `req.user` → fall through to user lookup.
3. If no access token → read `user_id` + `refresh_token` cookies → if missing, return `{ user: null }`.
4. Call `rotateRefreshTokenWithLock(userId, refreshToken)` → if success, `setAuthCookies()` → set `req.user`.
5. Look up user in DB → return `{ user, accessTokenExpiresAt: Date.now() + 15 * 60 * 1000 }`.
6. If all fail → return `{ user: null }` (client treats this as logged-out state).

**Why re-set the cookie on valid token?** The cookie `maxAge` is 15 minutes, and the background refresh timer fires at ~14 minutes (1 minute before expiry). By re-setting the cookie on every valid `/session` call, the 15-minute window restarts, preventing a race where the cookie expires between the timer firing and the server responding.

## [Scenario F] Logout

`POST /auth/EmailVerificaitonRouter/logout`:
1. Hash the `refresh_token` from cookies with `refresh_salt`.
2. `updateMany` where hash matches → set `refresh_token_hash = null, refresh_token_expiry = null`.
3. Clear all four auth cookies (`access_token`, `refresh_token`, `refresh_salt`, `user_id`).
4. Respond with `{ message: 'Logged out' }`.

---

# Frontend Auth State Management

## AuthContext Architecture

`src/context/AuthContext.tsx` manages all client-side auth state using a **React state-driven refresh loop**:

### Key Components

- **Module-level `backgroundTimerId`**: A single `setTimeout` reference shared across renders. Cleared and re-scheduled on each loop cycle.
- **`loopTriggerIndex` state**: An integer that increments each time the background timer fires, triggering a new `useEffect` cycle.
- **`updateLocalAuthState(user, expiresAt)`**: Single source of truth for syncing auth state to Redux + localStorage.
- **`fetchAndSaveRenewedSession()`**: Calls `GET /session`, updates state via `updateLocalAuthState`, returns the new expiry timestamp.

### Session Persistence Flow

1. **On mount**: Read `convoflow_session` from `localStorage` → if valid (expiry in the future), optimistically dispatch `setUser()` to Redux (instant UI hydration, no loading flash).
2. **Always hit server**: Call `fetchAndSaveRenewedSession()` which hits `GET /session`. The server issues a fresh access token (or rotates the refresh token if needed) and returns `{ user, accessTokenExpiresAt }`.
3. **`loading` set to `false`**: Only after the server responds. Until then, `ProtectedRoute` shows a spinner.
4. **Schedule next refresh**: `scheduleBrowserTimeout(expiresAt, callback)` sets a timer for `(expiresAt - 60 seconds)`. When it fires, `loopTriggerIndex` increments, re-triggering the `useEffect`.

### Why This Design

- **No loading flash**: localStorage provides instant UI. The server call happens in the background and updates if needed.
- **No race conditions**: The `backgroundTimerId` is module-level (not in state), so only one timer exists at a time regardless of re-renders.
- **Self-healing**: If the server rejects the session (expired refresh token), `fetchAndSaveRenewedSession` catches the error and calls `updateLocalAuthState(null)`, logging the user out.

### Auth Actions

- **`login(email, password)`**: POSTs to `/login`, calls `updateLocalAuthState(user, expiresAt)`, schedules the next background refresh.
- **`signup(user_name, email, password)`**: POSTs to `/signup`, returns the user object (no tokens issued — user must verify email first).
- **`logout()`**: Calls `updateLocalAuthState(null)` (clears Redux + localStorage), POSTs to `/logout` (server clears cookies and invalidates refresh token).
- **`refreshSession()`**: Manually triggers `fetchAndSaveRenewedSession()` and reschedules the timer.

---

# Rate Limiting

**File**: `services/rateLimiter.ts`

- **Window**: 1 minute (sliding window via Redis sorted set).
- **Max attempts**: 10 per minute per IP.
- **Block duration**: 5 minutes once the limit is exceeded.
- **Storage**: Redis sorted set (`rate_limit:<ip>`) + block key (`rate_limit:blocked:<ip>`).
- **TTL**: 10 minutes on each sorted set key (auto-cleanup).
- **Fail-open**: If Redis is unreachable, the rate limiter falls back to an in-memory `Map`. Requests are allowed to proceed (fail-open) rather than rejecting all traffic when Redis is down. The in-memory fallback does not persist across server restarts.

Applied on:
- `POST /check-password`
- `POST /login`

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

**`setAuthCookies`** is defined in `services/authCookieSessions.ts` and used by all token-setting flows (login, verify, session refresh, middleware rotation).

**`clearAuthCookies`** (`services/authCookieSessions.ts`) clears all 4 cookies. Used by logout and failed refresh.

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
| `image_url` | String? | Profile picture (S3 key — signed before sending to client) |
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
| `/auth/EmailVerificaitonRouter/login` | POST | Authenticate + issue tokens + return `accessTokenExpiresAt` |
| `/auth/EmailVerificaitonRouter/logout` | POST | Invalidate refresh token + clear cookies |
| `/auth/UserVerificaitonRouter/verify` | POST | Verify email with 6-digit code |
| `/auth/UserVerificaitonRouter/resend-verification` | POST | Resend verification code |
| `/auth/TokenVerificationRouter/session` | GET | Hydrate client auth state + re-set cookie + rotate if needed. Returns `{ user, accessTokenExpiresAt }` |
| `/auth/TokenVerificationRouter/refresh` | POST | Explicit token refresh. Returns `{ message, accessTokenExpiresAt }` |
| `/auth/WsTicketRouter/ws-ticket` | GET | Generate one-time WebSocket auth ticket (requires valid auth cookie) |

---

# Edge Cases & Mitigations

| Concern | Mitigation |
|---------|------------|
| **Stolen access token** | Short expiry (15 min). No sensitive data in JWT payload. Token bound to audience `authenticated`. |
| **Stolen refresh token** | Rotation on every use — old token invalidated. Hash stored in DB (not plaintext). 30-day expiry window. |
| **Refresh token race condition** | `rotateRefreshTokenWithLock()` deduplicates concurrent rotation attempts per userId. Only one rotation runs; others get the same promise. |
| **Brute force login** | Rate limiting per IP (10 attempts / 1 min). bcrypt (slow). Constant-time dummy hash for users with no password set. |
| **Token replay** | Refresh token rotation invalidates previous tokens. Old hash stored in Redis for detection. |
| **XSS stealing cookies** | All cookies are `httpOnly` + `secure` + `sameSite: lax`. No token accessible via JS. |
| **CSRF** | `sameSite: lax` prevents cross-site form submissions. `validateOrigin.ts` checks `x-forwarded-host` (production) or `Origin`/`Referer` (dev) on mutating requests. |
| **Orphaned Supabase auth users** | Rollback: if Prisma insert fails, the new Supabase auth user is deleted. |
| **Expired verification code** | In-memory TTL of 15 min. User can request resend. |
| **User enumeration** | Login returns `404 "User not found"` for non-existent emails and `401 "Invalid email or password"` for wrong passwords — these are different status codes and messages, so the email address is leakable. Constant-time bcrypt compare prevents timing-based enumeration. |
| **Redis unavailable** | Rate limiter falls back to in-memory (fail-open). Refresh token old hash write is non-fatal (try-catch). |

---

# Security Guardrails

- **Helmet**: HTTP security headers (CSP, HSTS, frameguard, noSniff, etc.).
- **CORS**: Configured origin restrictions, enforced `x-forwarded-host` (production) or `Origin`/`Referer` validation on state-changing methods.
- **httpOnly cookies**: Tokens inaccessible to JS.
- **bcrypt**: Password hashing (12 rounds) + refresh token hashing (10 rounds).
- **JWT verification**: Audience (`authenticated`) + secret checked on every verify.
- **Rate limiting**: IP-based throttling on auth endpoints (Redis-backed sliding window, in-memory fallback).
- **HIBP integration**: Reject known compromised passwords at signup.
- **`authenticate` middleware**: All protected routes go through `middleware/authenticate.ts` which verifies JWT or refreshes via locked rotation. Handles concurrent requests safely.
- **Chat membership checks**: All message CRUD endpoints verify user is a member of the target chat.
- **XSS prevention**: All user message content is HTML-escaped before storage (`escapeHtml` on every write path).
- **Refresh token replay detection**: Old token hashes stored in Redis; replayed tokens detected and invalidated.
- **Environment variables**: `SUPABASE_JWT_SECRET`, `SUPA_BASE_URL`, `SUPA_BASE_ANON_PUBLISHABLE_KEY`, `EMAIL_USER`, `EMAIL_PASSWORD`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` stored in env.

---

# Features to Add

## High Priority
- [x] **Redis-backed rate limiting** — in-memory `Map` replaced with Redis sorted sets (rateLimiter.ts)
- [x] **Refresh token race condition fix** — `rotateRefreshTokenWithLock()` deduplicates concurrent rotations
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
