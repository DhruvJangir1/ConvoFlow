# User Authentication — Clerk/OAuth Flow

# High-Level Architecture
```
[Client Browser] <--> [Clerk (auth + OAuth + session management)]
       |
       v
[Express Server] <--> [Prisma ORM] <--> [PostgreSQL (public.USERS)]
       |
  [Gmail SMTP] (friend request emails)
```

**Stack**: Node.js + Express, Clerk (authentication, OAuth, session/token management), Prisma + PostgreSQL (app-level user data + `clerk_id` mapping), Gmail SMTP via Nodemailer (friend request emails).

---

# Low-Level Architecture

## 1. Component Inventory

### Frontend (React)

| File | Responsibility | Key details |
|------|----------------|-------------|
| `src/main.tsx` | Bootstrap + provider nesting | `ClerkProvider(publishableKey)` → `QueryClientProvider` → `Provider(Redux)` → `AuthProvider` → `WebSocketProvider` → `App` |
| `src/App.tsx` | Route table | `/auth` → `LoginForm`, `/sso-callback` → `SSOCallbackPage`; protected routes nested under `ProtectedRoute → RootLayout` |
| `src/auth/SSOCallbackPage.tsx` | OAuth callback route | Renders branded loading UI ("Completing your sign-in...") as a sibling of `<AuthenticateWithRedirectCallback />` (which returns `null` and does the real work — this avoids the previous empty screen) |
| `src/auth/LoginForm.tsx` | `/auth` page | Renders `<ContinueWithConvoFlow />`; redirects to `/home` if a Redux user already exists; spinner while `AuthContext.loading` |
| `src/auth/ContinueWithConvoFlow.tsx` | OAuth entry | `useSignIn` from `@clerk/react/legacy`; calls `signIn.authenticateWithRedirect({ strategy, redirectUrl: '/sso-callback', redirectUrlComplete: '/home' })`; strategies `oauth_google` / `oauth_microsoft` |
| `src/context/AuthContext.tsx` | Clerk → Redux sync | `useUser()` + `useClerkAuth().getToken`; registers `setGetTokenFn(getToken)`; on session fires `POST /api/auth/setup-user` → `dispatch(setUser(dbUser))`; exposes `loading = !(isLoaded && dbUserFetched)` |
| `src/lib/clerkFetch.ts` | Authenticated fetch wrapper | Module-level `getTokenFn`; injects `Authorization: Bearer`; 15s `AbortController` timeout; single 401 retry (only if a fresh token is returned) |
| `src/components/ProtectedRoute.tsx` | Route guard | Spinner while loading, redirects to `/auth` when Redux `user` is null |

### Backend (Express)

| File | Responsibility | Key details |
|------|----------------|-------------|
| `backend/src/routes/auth.ts` | Auth router hub | `POST /setup-user` (authenticated) → returns DB user via `PRISMA_SAFE_SELECT` with `image_url` resolved to a presigned URL; mounts `WsTicketRouter` |
| `backend/src/routes/wsTicket.ts` | WS ticket issuance | `GET /ws-ticket` (authenticated) → `{ ticket }` via `generateTicket(req.user.id)` |
| `backend/src/middleware/authenticate.ts` | Protected-route gate | Bearer extraction → Clerk JWT verify → `clerk_id` lookup → email link → auto-provision → `req.user = { id, email }` (DB UUID) |
| `backend/src/lib/auth.ts` | Clerk abstraction (only file importing `@clerk/backend`) | `verifyClerkToken()` — local `verifyToken()` with `CLERK_SECRET_KEY`; `fetchClerkUser()` — `clerkClient.users.getUser()` + primary-email extraction |
| `backend/src/services/wsTicketStore.ts` | WS ticket store | In-memory `Map<ticket, { userId, expiresAt }>` |
| `backend/src/services/rateLimiter.ts` | IP throttling | Redis sorted set + in-memory fallback |
| `backend/src/services/authVerificaiton.ts` | Email sending | `sendFriendRequestEmail()` via Gmail SMTP / Nodemailer |
| `backend/src/supabase/admin.ts` | Supabase service-role client | `getAdminClient()` — cached singleton reading `SUPA_BASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; used only for `auth.admin.createUser()` during provisioning |
| `backend/src/lib/connectionPoolClient.ts` | Prisma client | Shared `prisma` instance across all flows |

## 2. Initialization & Provider Sequence

```
main.tsx mounts:
  ClerkProvider(publishableKey)
  └─ QueryClientProvider
     └─ Provider (Redux)
        └─ AuthProvider
           ├─ setGetTokenFn(getToken)        ← registers JWT producer into clerkFetch
           ├─ useUser() → clerkUser
           ├─ isLoaded? ──no──▶ loading = true
           │
           └─ isLoaded? ──yes──▶ clerkUser present?
                ├─ yes → POST /api/auth/setup-user via clerkFetch
                │        ├─ ok   → dispatch(setUser(dbUser))    → loading = false
                │        └─ fail → dispatch(setUser(null))      → loading = false
                └─ no  → dispatch(setUser(null)) + resetChats() → loading = false
```

`setGetTokenFn(getToken)` runs on every `AuthProvider` render (not inside an effect), so `clerkFetch` always has the current Clerk `getToken` producer before any request fires.

## 3. Request Lifecycle — Protected API Call

```
React hook / modal                     Express server
──────────────────                     ─────────────
clerkFetch('/api/chats')               incoming request
  ├─ getTokenFn() → Clerk JWT           ├─ helmet / cors / cookie-parser / validateOrigin
  ├─ Authorization: Bearer <jwt>  ───▶  ├─ authenticate (protected routes only)
  ├─ credentials: 'include'              │  1. regex /^Bearer\s+(.+)$/i  ──────────▶ 401 if missing/malformed
  └─ 15s AbortController timeout         │  2. verifyClerkToken(jwt) ──────────────▶ 401 on TokenVerificationError
                                         │  3. users.findFirst({ clerk_id }) ──found──▶ req.user, next()
                                         │  4. fetchClerkUser(clerkId) → email ──────▶ 500 if Clerk API fails, 401 if no email
                                         │  5. users.findFirst({ email })
                                         │       ├─ clerk_id set to a different value ─▶ 409 (takeover guard)
                                         │       └─ else update clerk_id ──────────────▶ req.user, next()
                                         │  6. auto-provision (first login):
                                         │       supabase.auth.admin.createUser({ email, email_confirm: true })
                                         │       → unique user_tag collision loop
                                         │       → clerkUsers.upsert({ clerk_id, email })
                                         │       → users.create({ id: authUserId, ... is_verified: true })
                                         │       → req.user, next()
                                         └─ route handler uses req.user.id (DB UUID)
```

## 4. OAuth Sign-In / Sign-Up Sequence

```
1. /auth → LoginForm → ContinueWithConvoFlow
2. signIn.authenticateWithRedirect({ strategy, redirectUrl: '/sso-callback', redirectUrlComplete: '/home' })
3. Clerk redirects browser → Google / Microsoft
   (unknown emails are auto-provisioned as new Clerk accounts — no separate signup step)
4. Provider redirects back → /sso-callback → `SSOCallbackPage` shows a loading page while `<AuthenticateWithRedirectCallback />` finalizes the session
5. useUser() fires → AuthContext POSTs /api/auth/setup-user
6. authenticate middleware maps clerk_id → DB UUID, creating the DB row on first login
7. dispatch(setUser(dbUser)) → Redux → ProtectedRoute lets the user through
```

## 5. In-Memory Auth Stores

| Store | Module | Key → Value | TTL | Cleanup | Lifecycle |
|-------|--------|-------------|-----|---------|-----------|
| WS tickets | `wsTicketStore.ts` | `ticket → { userId, expiresAt }` | 60 s (`TICKET_TTL_MS`) | every 30 s | single-use — deleted in `consumeTicket()`, then expiry re-checked |
| Rate limiter (Redis) | `rateLimiter.ts` | `rate_limit:<ip>` (sorted set) + `rate_limit:blocked:<ip>` | 600 s window key, 300 s block | `expire` per write | 10 attempts / 60 s window → block 5 min |
| Rate limiter (fallback) | `rateLimiter.ts` | `memoryAttempts: ip → number[]`, `memoryBlocks: ip → expiry` | 60 s / 300 s | inline filter on each call | process-local, lost on restart (fail-open) |

## 6. Error Handling Matrix (`authenticate` middleware)

| Scenario | Status | Body | Raised at |
|----------|--------|------|-----------|
| No `Authorization` header | 401 | `{ error: 'Authentication required' }` | header check |
| Malformed header (not `Bearer`) | 401 | `{ error: 'Authentication required' }` | regex match |
| `payload.sub` empty | 401 | `{ error: 'Invalid token payload' }` | after JWT verify |
| Expired / invalid JWT | 401 | `{ error: 'Invalid or expired token' }` | `TokenVerificationError` catch |
| Clerk user API failure | 500 | `{ error: 'Failed to fetch user info from Clerk' }` | `fetchClerkUser` try/catch |
| Clerk account has no email | 401 | `{ error: 'No email found for this Clerk account' }` | email check |
| Email owned by another Clerk account | 409 | `{ error: 'Email already associated with another account' }` | account-link guard |
| Supabase user creation failure | 500 | `{ error: 'Failed to create auth user' }` | auto-provision step |
| Supabase admin unavailable | 500 | `{ error: 'Auth provisioning unavailable — check server configuration' }` | outer provisioning catch |
| Unexpected error | 500 | `{ error: 'Internal server error' }` | outer catch |

## 7. Environment Variable Dependency Map

| Env var | Consumed by | Purpose |
|---------|-------------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | `src/main.tsx` | `ClerkProvider` init (browser) |
| `CLERK_SECRET_KEY` | `lib/auth.ts` (`createClerkClient`, `verifyToken`) | Backend JWT verification + Clerk API calls |
| `SUPA_BASE_URL` | `supabase/admin.ts` | Supabase admin client URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase/admin.ts` | Auto-provision via `auth.admin.createUser()` |
| `DATABASE_URL` / `DIRECT_URL` | `connectionPoolClient.ts` | Prisma connection |
| `EMAIL_USER`, `EMAIL_PASSWORD` | `authVerificaiton.ts` | Gmail SMTP credentials |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | `redis/redisClient.ts` | Rate limiter storage |

## 8. Secrets & Trust Boundary

```
Browser (untrusted)                     Server (trusted)
─────────────────────                   ────────────────
VITE_CLERK_PUBLISHABLE_KEY              CLERK_SECRET_KEY
(public, safe to expose)                (JWT verify + Clerk API calls)
  │                                     │
  ├─ Clerk session cookie ──────────────┤  never read by app code; session
  │   (managed by Clerk SDK)            │  validity is derived from the
  │                                     │  verified JWT, not this cookie
  │                                     │
  ├─ JWT → Authorization: Bearer ───────▶  verifyClerkToken(token)
  │                                     ├─ users.findFirst({ clerk_id: payload.sub })
  │                                     └─ req.user = { id: DB UUID, email }
```

The app never writes app-level httpOnly tokens. Every state-changing server decision is derived from the **verified JWT subject** (`payload.sub` → DB `clerk_id`), and every frontend API call must flow through `clerkFetch` to attach that JWT.

---

# How Authentication Works

ConvoFlow uses **Clerk** for authentication. Clerk handles user management, OAuth (Google/Microsoft), session cookies, token rotation, and MFA. The application **never reads or writes auth tokens in JavaScript** — Clerk manages its own session cookies transparently.

- **Frontend** uses `@clerk/react` hooks (`useUser()`, `useAuth()`, `useClerk()`) to determine login state.
- **Backend** verifies Clerk JWTs server-side via a centralized abstraction layer — **`backend/src/lib/auth.ts`** — the only file that imports `@clerk/backend`.
- **No custom refresh-token system.** Access to protected APIs is granted by a Clerk JWT sent in the `Authorization: Bearer <token>` header.

## Token Strategy

| Token | Type | Storage | Lifetime | Notes |
|-------|------|---------|----------|-------|
| **Clerk JWT** | JWT signed by Clerk | `Authorization: Bearer` header (frontend attaches via `clerkFetch`) | Short-lived (Clerk-managed) | Verified in `lib/auth.ts:verifyClerkToken()` |
| **Session** | Clerk session cookie | Browser (managed by Clerk SDK) | Clerk-managed | Drives `useUser()`/`useAuth()` on the client |

There is **no refresh token in the app's control** — Clerk handles token rotation transparently. If a request returns 401, `clerkFetch` re-fetches a fresh JWT via `getToken()` and retries once.

---

# Frontend Auth Flow

```
1. ClerkProvider initializes with publishableKey (src/main.tsx)
2. AuthContext uses useUser() and useAuth() from @clerk/react
3. When Clerk session is available:
   a. useUser() returns the Clerk user object
   b. AuthContext builds a User object (id, user_name, email, image_url, etc.)
   c. Dispatches setUser() to Redux — user is now "logged in"
4. When Clerk session ends:
   a. useUser() returns null
   b. AuthContext dispatches setUser(null) — user is now "logged out"
```

## Login/Signup Flow (OAuth)

```
1. User navigates to /auth (via LandingPage CTA or ProtectedRoute redirect)
2. LoginForm renders <ContinueWithConvoFlow /> — Google + Microsoft buttons
3. Clicking a provider calls signIn.authenticateWithRedirect({ strategy, redirectUrl: '/sso-callback', redirectUrlComplete: '/home' })
   — via useSignIn from @clerk/react/legacy (the default @clerk/react useSignIn is a "future" API without this method)
4. Clerk redirects the browser to the provider; unknown emails are auto-provisioned as new accounts (no separate signup step)
5. Provider redirects back to /sso-callback → `SSOCallbackPage` shows a loading page while `<AuthenticateWithRedirectCallback />` finalizes the session
6. useUser() in AuthContext fires with the new user → Redux state updates → UI re-renders
7. ProtectedRoute sees user in Redux → allows access to protected pages
```

## Logout Flow

```
1. User clicks logout in Navbar or ProfileModal
2. Component calls useClerk().signOut()
3. Clerk destroys the session and clears its internal state
4. useUser() returns null → AuthContext dispatches setUser(null) + resetChats() → Redux clears user + chat state
5. ProtectedRoute detects user is null via useEffect → navigates to /auth
```

> There is **no backend logout endpoint** — Clerk manages session invalidation entirely.

---

# `clerkFetch` Utility (`src/lib/clerkFetch.ts`)

Every frontend API call goes through `clerkFetch()`:

```ts
import { clerkFetch } from '../lib/clerkFetch';

const res = await clerkFetch('/api/chats');
```

1. `AuthProvider` calls `setGetTokenFn(getToken)` on mount so the module-level `getTokenFn()` can produce the current Clerk JWT.
2. `clerkFetch` calls `getTokenFn()` → attaches `Authorization: Bearer <token>`.
3. Calls `fetch()` with `credentials: 'include'`.
4. On **401**, calls `getTokenFn()` once more (forces a fresh JWT) and retries the request.
5. If `getToken` returns null, the request proceeds without an Authorization header and will 401.

All frontend API calls must use `clerkFetch` — never raw `fetch()`.

---

# Authenticate Middleware (`backend/src/middleware/authenticate.ts`)

Every protected API route uses this middleware:

```
1. Extract Bearer token from Authorization header using regex /^Bearer\s+(.+)$/i
2. If missing or malformed → 401 "Authentication required"
3. verifyClerkToken(token) → { sub: clerkId }   (lib/auth.ts wrapper)
   On TokenVerificationError (expired/invalid) → 401, not 500
4. Look up user by clerk_id in DB → req.user = { id: dbUuid, email } → next()
5. If not found → auto-provision:
   a. fetchClerkUser(clerkId) → email from Clerk API
   b. Existing user by email?
      - If it has a clerk_id set to a different value → 409 (blocks account takeover)
   c. supabase.auth.admin.createUser() → prisma.clerkUsers.upsert() → prisma.users.create()
```

**Clerk ID vs DB UUID**: Clerk user IDs (e.g., `user_3Gp...`) are NOT valid UUIDs. The middleware maps Clerk IDs to internal DB UUIDs via the `clerk_id` column on `USERS`. `req.user.id` is always the DB UUID.

---

# WebSocket Auth Flow

```
1. Frontend calls GET /api/auth/WsTicketRouter/ws-ticket via clerkFetch (sends Clerk JWT)
2. authenticate middleware verifies the JWT → req.user.id is set
3. Server: generateTicket(req.user.id) → stores userId in in-memory Map (60s TTL)
4. Server returns: { ticket: "<uuid>" }
5. Frontend opens WebSocket: ws://host/ws?ticket=<ticket>
6. WebSocket server: consumeTicket(ticket) → get userId → set ws.userId
7. Server: fetch user profile from DB → set ws.userName, ws.userImage
```

---

# Rate Limiting

**File**: `services/rateLimiter.ts`

- **Window**: 1 minute (sliding window via Redis sorted set).
- **Max attempts**: 10 per minute per IP.
- **Block duration**: 5 minutes once the limit is exceeded.
- **Storage**: Redis sorted set (`rate_limit:<ip>`) + block key (`rate_limit:blocked:<ip>`).
- **TTL**: 10 minutes on each sorted set key (auto-cleanup).
- **Fail-open**: If Redis is unreachable, falls back to an in-memory `Map` (does not persist across restarts).

Applied on:
- `POST /api/friends/send`

---

# Database Schema (public.USERS)

**File**: `prisma/schema.prisma`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Internal DB UUID, linked to Clerk via `clerk_id` |
| `user_name` | String | Unique |
| `email` | String | Unique — linked to `clerkUsers` table |
| `image_url` | String? | Profile picture (S3 key — signed before sending to client) |
| `is_verified` | Boolean | Email verification status |
| `bio` | String? | User bio |
| `user_tag` | String | Unique — `username#0001` format |
| `role` | String | `"user"` by default |
| `last_login` | DateTime | |
| `created_at` | DateTime | |
| `clerk_id` | String? | Maps Clerk user ID → internal UUID (set by `authenticate` auto-provision) |
| `password` | String? | **Unused** — legacy column from the pre-Clerk auth system |
| `refresh_token_hash` | String? | **Unused** — legacy column from the pre-Clerk auth system |
| `refresh_token_expiry` | DateTime? | **Unused** — legacy column from the pre-Clerk auth system |

There is also a `clerkUsers` table that stores Clerk user metadata, referenced by `USERS.clerk_id` and `USERS.email`.

---

# API Routes Summary

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/setup-user` | POST | Clerk JWT | Create/return DB user for the current Clerk session |
| `/api/auth/WsTicketRouter/ws-ticket` | GET | Clerk JWT | Generate one-time WebSocket auth ticket |

---

# Edge Cases & Mitigations

| Concern | Mitigation |
|---------|------------|
| **Expired/invalid JWT** | `TokenVerificationError` → 401 (not 500). `clerkFetch` retries once with a fresh token. |
| **Missing/malformed header** | Regex `/^Bearer\s+(.+)$/i` → 401. No lenient `.startsWith`. |
| **Unknown Clerk user (no DB row)** | Auto-provision: fetch from Clerk API → create Supabase auth user → `clerkUsers.upsert` → `users.create`. |
| **Account takeover by email** | If an existing user's `clerk_id` is already set to a different Clerk account, linking is rejected (409). |
| **CSRF** | `validateOrigin.ts` checks `x-forwarded-host` (production) or `Origin`/`Referer` (dev) on mutating requests. |
| **Brute force on sensitive endpoints** | Rate limiting per IP (10/min, 5-min block) on `/api/friends/send`. |
| **Redis unavailable** | Rate limiter falls back to in-memory (fail-open). |
| **XSS stealing tokens** | Clerk JWTs are short-lived and attached per-request; the session cookie is managed by Clerk's SDK. No app-level httpOnly token handling needed. |

---

# Security Guardrails

- **Helmet**: HTTP security headers (CSP, HSTS, frameguard, noSniff, etc.).
- **CORS**: Configured origin restrictions; production `CORS_ORIGIN` must be a real URL (no wildcards).
- **Clerk JWT verification**: All protected routes go through `middleware/authenticate.ts`, which verifies via the `lib/auth.ts` wrapper (the only file importing `@clerk/backend`).
- **Rate limiting**: IP-based throttling on `/api/friends/send` (Redis-backed sliding window, in-memory fallback).
- **Chat membership checks**: All message CRUD endpoints verify the user is a member of the target chat.
- **Environment variables**: `CLERK_SECRET_KEY` (backend), `VITE_CLERK_PUBLISHABLE_KEY` (frontend), `EMAIL_USER`, `EMAIL_PASSWORD`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SUPA_BASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, S3 vars.
