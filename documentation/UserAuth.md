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

**Rotation**: Every time a refresh token is used, it is rotated — the old hash is replaced with a new one in the DB. This limits the damage of a leaked refresh token (replay detection).

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
2. **Rate limit check**: `trackAuthAttempt(ipAddress)` — allows 10 attempts per 5-minute window per IP.
3. **Validate input**: email + password required, password >= 8 chars.
4. **Lookup user** in `public.USERS` by email.
5. **Compare password** with bcrypt (`comparePassword()`). Uses a **constant-time dummy hash** for non-existent users to prevent user enumeration via timing.
6. **Issue tokens**: sign new access JWT, generate new refresh token + salt, update refresh hash in DB.
7. **Set cookies** and respond with `{ user }`.

- **The Goal** = to have the user never have to come to the log in page, unless if he logged out purposefully.
- So if a user who signed up, should not have to go to the login page cuz his refresh/access token expired.

## [Scenario D] Authenticated Request (Middleware)

1. Request hits `middleware/authenticate.ts`.
2. Check `req.cookies` exists — if not, return 401.
3. Check for `access_token` cookie:
   - **Present + valid JWT**: attach `req.user = { id, email }` and call `next()`.
   - **Present but expired**: attempt refresh (step 4). If refresh succeeds, call `next()`. If fails, return 401 with `X-Token-Expired: true`.
   - **Missing**: attempt refresh (step 4). If refresh succeeds, `next()`. If fails, return 401.
4. **Refresh flow** (`auth.ts:refreshUserAccessToken()`):
   - Read `refresh_token` + `refresh_salt` cookies.
   - Hash the refresh token with the salt using bcrypt.
   - Look up `public.USERS` where `refresh_token_hash` matches and `refresh_token_expiry >= now()`.
   - If found: sign a **new access JWT**, generate a **new refresh token** (rotation), update DB, set new cookies, attach `req.user`.
   - If not found: return without setting `req.user` — middleware then returns 401.

## [Scenario E] Session Check

`GET /auth/TokenVerificaitonRouter/session` — called on page load to hydrate client-side auth state:
1. If `access_token` exists and is valid → look up user in DB → return `{ user }`.
2. If `access_token` is missing or expired → attempt refresh → if successful, look up user → return `{ user }`.
3. If all fail → return `{ user: null }` (client treats this as logged-out state).

## [Scenario F] Logout

`POST /auth/EmailVerificaitonRouter/logout`:
1. Hash the `refresh_token` from cookies with `refresh_salt`.
2. `updateMany` where hash matches → set `refresh_token_hash = null, refresh_token_expiry = null`.
3. Clear all three auth cookies.
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

**File**: `util/constants.ts`

```ts
COOKIE_OPTIONS = {
  httpOnly: true,       // not accessible via JS (XSS mitigation)
  secure: true,         // HTTPS only
  sameSite: 'lax',      // CSRF mitigation
  path: '/',
}
```

| Cookie | Max Age |
|--------|---------|
| `access_token` | 15 minutes |
| `refresh_token` | 30 days |
| `refresh_salt` | 30 days |

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
| `/auth/TokenVerificaitonRouter/session` | GET | Hydrate client-side auth state |
| `/auth/TokenVerificaitonRouter/refresh` | POST | Explicit token refresh |

---

# Edge Cases & Mitigations

| Concern | Mitigation |
|---------|------------|
| **Stolen access token** | Short expiry (15 min). No sensitive data in JWT payload. Token bound to audience `authenticated`. |
| **Stolen refresh token** | Rotation on every use — old token invalidated. Hash stored in DB (not plaintext). 30-day expiry window. |
| **Brute force login** | Rate limiting per IP (10 attempts / 5 min). bcrypt (slow). Constant-time dummy hash for unknown users. |
| **Token replay** | Refresh token rotation invalidates previous tokens. Access tokens are short-lived. |
| **XSS stealing cookies** | All cookies are `httpOnly` + `secure` + `sameSite: lax`. No token accessible via JS. |
| **CSRF** | `sameSite: lax` prevents cross-site form submissions. Consider CSRF tokens for state-changing ops. |
| **Orphaned Supabase auth users** | Rollback: if Prisma insert fails, the new Supabase auth user is deleted. |
| **Expired verification code** | In-memory TTL of 15 min. User can request resend. |
| **User enumeration** | Login returns same error for non-existent user and wrong password. Constant-time bcrypt compare. |
| **In-memory state loss on restart** | Rate limiter now uses Redis (persists across restarts). Verification codes remain in-memory (15-min TTL). |

---

# Security Guardrails

- **Helmet**: HTTP security headers (X-Content-Type-Options, X-Frame-Options, etc.).
- **CORS**: Configured origin restrictions.
- **httpOnly cookies**: Tokens inaccessible to JS.
- **bcrypt**: Password hashing (12 rounds) + refresh token hashing (10 rounds).
- **JWT verification**: Audience (`authenticated`) + secret checked on every verify.
- **Rate limiting**: IP-based throttling on auth endpoints.
- **HIBP integration**: Reject known compromised passwords at signup.
- **Environment variables**: `SUPABASE_JWT_SECRET`, `SUPA_BASE_URL`, `SUPA_BASE_ANON_PUBLISHABLE_KEY`, `RESEND_API_KEY` stored in `.env`.

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
- [ ] **Refresh token family tree** — track parent-child relationships of rotated refresh tokens to detect token reuse (theft detection)
- [ ] **Magic link login** — passwordless email login via one-time tokens (Supabase supports this)
- [ ] **Social login linking** — allow users to link multiple OAuth providers to the same account
- [ ] **Rate limit by userId + IP** — combine userId-level and IP-level rate limiting for more granular control
 


---