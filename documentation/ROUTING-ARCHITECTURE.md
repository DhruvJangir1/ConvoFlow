# Routing Architecture

This document explains how HTTP requests flow through the backend routing system, from `server.js` down to the route handlers and services.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [server.js — The Entry Point](#2-serverjs--the-entry-point)
3. [auth.ts — The Router Hub](#3-authts--the-router-hub)
4. [Sub-Routers — Route Files](#4-sub-routers--route-files)
5. [Complete Request Flow](#5-complete-request-flow)
6. [Mounting New Routes](#6-mounting-new-routes)
7. [Endpoint Map](#7-endpoint-map)

---

## 1. High-Level Overview

Every request follows this path:

```
Client (Browser / React)
       │
       ▼
  Vite Proxy (dev)  ──►  server.js
                           │
               ┌───────────┼──────────────┬───────────────┬───────────────┬──────────────┐
               ▼           ▼              ▼               ▼               ▼              ▼
           /api/auth  /api/chats    /api/users    /api/friends  /api/notifications  /api/anonymousChats
               │
     ┌─────────┼───────────┬──────────────┐
     ▼         ▼           ▼              ▼
  EmailVer   TokenVer   UserVer      WsTicket
  ification  ification  ification    Router
  Router     Router     Router
  ─────────  ─────────  ──────────   ─────────
  /signup    /session   /verify      /ws-ticket
  /login     /refresh   /resend-
  /logout               verification
  /check-
  password
```

---

## 2. server.js — The Entry Point

**File:** `backend/server.js`

`server.js` creates the Express app, applies global middleware, and mounts top-level routers.

### Global Middleware (applied to every request)

```js
app.use(express.json());              // Parse JSON bodies
app.use(cors({ origin, credentials })); // Cross-origin requests
app.use(cookieParser());              // Parse cookies into req.cookies
app.use(urlencoded({ extended: true })); // Parse URL-encoded bodies
```

### CSRF Protection (state-changing methods only)

```js
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return validateOrigin(req, res, next);
  }
  return next();
});
```

- Only `POST`, `PUT`, `PATCH`, `DELETE` are validated.
- `GET` requests (like `/session`) skip this check.

### Router Mounting

```js
app.use("/api/auth", AuthRouter);           // All auth-related routes
app.use("/api/chats", ChatRouter);          // Chat CRUD and messaging
app.use("/api/users", UserRouter);          // User profile operations
app.use("/api/friends", FriendRouter);      // Friend request management
app.use("/api/notifications", NotificationRouter); // Notification management
app.use("/api/anonymousChats", AnonymousChatRouter); // Anonymous chat rooms
app.get("/api/health", ...);                // Health check (no router)
app.get("/health/db", ...);                 // DB pool health check
app.get("/metrics", ...);                   // Prometheus metrics
```

> **Key point:** `server.js` never defines route handlers directly (except health and metrics). It only mounts routers. This keeps the file thin and focused on server configuration.

---

## 3. auth.ts — The Router Hub

**File:** `backend/src/routes/auth.ts`

`auth.ts` is not a route handler file. It is a **router hub** that imports and mounts sub-routers under `/api/auth`.

### Current Mounts

```ts
import AuthEmailVerificaitonRouter from './authEmailVerification.js';
import AuthTokenVerificaitonRouter from './authTokenVerification.js';
import AuthUserVerificaitonRouter from './authUserVerification.js';
import WsTicketRouter from './wsTicket.js';

const AuthRouter = Router();

AuthRouter.use("/EmailVerificaitonRouter", AuthEmailVerificaitonRouter);
AuthRouter.use("/TokenVerificaitonRouter", AuthTokenVerificaitonRouter);
AuthRouter.use("/UserVerificaitonRouter", AuthUserVerificaitonRouter);
AuthRouter.use("/WsTicketRouter", WsTicketRouter);
```

When you mount a sub-router with a prefix like `/EmailVerificaitonRouter`, Express prepends that prefix to every route defined inside the sub-router.

For example, if `AuthEmailVerificaitonRouter` defines `post('/signup', ...)`, the full path becomes `/api/auth/EmailVerificaitonRouter/signup`.

> **Key concept:** `Router.use()` merges routes from sub-routers. It does NOT create a new path segment unless you give it a prefix string.

### Design Philosophy

- **`auth.ts` contains zero route handlers.** It only wires sub-routers together.
- **Adding a new sub-router** means: (1) create the file, (2) import it in `auth.ts`, (3) mount with `Router.use()`.
- **Removing a sub-router** means: remove the `use()` line and the import.

---

## 4. Sub-Routers — Route Files

Each sub-router file is a standard Express `Router` that defines its own handlers and exports the router as default.

### a. AuthEmailVerification (`/api/auth/EmailVerificaitonRouter/*`)

**File:** `backend/src/routes/authEmailVerification.ts`

| Route | Method | Handler Responsibility |
|---|---|---|
| `/check-password` | POST | Validates password strength, queries HIBP for pwned passwords |
| `/signup` | POST | Creates user in Supabase Auth + local DB, sends verification email |
| `/login` | POST | Validates credentials, issues access + refresh tokens, sets cookies |
| `/logout` | POST | Invalidates refresh token in DB, clears auth cookies |

**Key services used:**
- `services/auth.ts` — `hashPassword`, `comparePassword`, `signAccessToken`, `generateRefreshToken`, `hashToken`
- `services/rateLimiter.ts` — `trackAuthAttempt`
- `services/authVerificaiton.ts` — `sendUserVerificationCode`, `setAuthCookies`
- `services/verificationStore.ts` — `setVerificationCode`

### b. AuthTokenVerification (`/api/auth/TokenVerificaitonRouter/*`)

**File:** `backend/src/routes/authTokenVerification.ts`

| Route | Method | Handler Responsibility |
|---|---|---|
| `/session` | GET | Validates access token (or refresh token if access expired), returns user or `{ user: null }` |
| `/refresh` | POST | Validates refresh token, rotates both tokens, sets new cookies |

**Key services used:**
- `services/auth.ts` — `signAccessToken`, `verifyAccessToken`, `generateRefreshToken`, `hashToken`

**Session handler behavior:**

```
                        ┌─ Access token valid? ──► Return user
                        │
Incoming GET /session ──┤
                        │
                        └─ Access token expired? ──► Refresh token valid? ──► Issue new access token ──► Return user
                                                     │
                                                     └─ No refresh token ──► Return { user: null }
                                                      or refresh expired
```

> **Note:** The `/session` endpoint always returns `200 OK`. For unauthenticated users it returns `{ user: null }` rather than a `401`. This prevents console errors and unwanted redirects on the landing page.

### c. AuthUserVerification (`/api/auth/UserVerificaitonRouter/*`)

**File:** `backend/src/routes/authUserVerification.ts`

| Route | Method | Handler Responsibility |
|---|---|---|
| `/verify` | POST | Accepts verification code, marks user as verified, issues tokens |
| `/resend-verification` | POST | Generates a new verification code and emails it |

**Key services used:**
- `services/verificationStore.ts` — `setVerificationCode`, `findUserIdByCode`, `deleteVerificationCode`
- `services/auth.ts` — `signAccessToken`, `generateRefreshToken`
- `services/authVerificaiton.ts` — `sendUserVerificationCode`, `setAuthCookies`

### d. WsTicketRouter (`/api/auth/WsTicketRouter/*`)

**File:** `backend/src/routes/wsTicket.ts`

| Route | Method | Handler Responsibility |
|---|---|---|
| `/ws-ticket` | GET | Generates a one-time WebSocket authentication ticket |

**Key services used:**
- `services/wsTicketStore.ts` — `generateTicket`

Generates a UUID ticket with a 60-second TTL stored in an in-memory Map. The client uses this ticket to authenticate the WebSocket connection at `ws://localhost:8080/ws?ticket=<ticket>`.

---

## 5. Complete Request Flow

Here is an example of a login request to trace the full path:

### `POST /api/auth/EmailVerificaitonRouter/login`

```
Step 1: Vite Dev Proxy
─────────────────────────────────────────────────────────
  The React frontend calls fetch('/api/auth/EmailVerificaitonRouter/login').
  Vite's proxy (vite.config.ts) forwards this to http://localhost:3000.

Step 2: server.js
─────────────────────────────────────────────────────────
  a. express.json()        — parses the request body into req.body
  b. cors()                — adds CORS headers (credentials: true)
  c. cookieParser()        — parses cookies into req.cookies
  d. CSRF middleware       — validates Origin/Referer header (POST = checked)
  e. Router dispatch       — matches "/api/auth" → forwards to AuthRouter

Step 3: auth.ts (Router Hub)
─────────────────────────────────────────────────────────
  AuthRouter.use("/EmailVerificaitonRouter", ...)  — matches prefix
  → forwards to AuthEmailVerificaitonRouter

Step 4: authEmailVerification.ts (Route Handler)
─────────────────────────────────────────────────────────
  Matches POST '/login'
    1. Extracts email + password from req.body
    2. Calls trackAuthAttempt(ip) — rate limiter
    3. Queries user from DB via prisma.users.findFirst
    4. Compares password via comparePassword()
    5. If invalid → returns 401
    6. If valid:
       a. signAccessToken(user.id, user.email) — creates JWT (15m expiry)
       b. generateRefreshToken() — creates opaque token + SHA-256 hash
       c. Stores refresh token hash in DB
       d. setAuthCookies(res, accessToken, refreshToken) — sets httpOnly cookies
       e. Returns { user } — JSON response with user data

Step 5: Response sent back to client
─────────────────────────────────────────────────────────
  JSON body    → { user: { id, user_name, email, image_url, is_verified } }
  Set-Cookie   → access_token (httpOnly, 15m)
                 refresh_token (httpOnly, 7 days)
```

---

## 6. Mounting New Routes

### Adding a new endpoint to an existing sub-router

Open the relevant sub-router file and add the route:

```ts
AuthEmailVerificaitonRouter.post('/forgot-password', async (req, res) => {
  // handler logic
});
```

The endpoint will automatically be available at `/api/auth/EmailVerificaitonRouter/forgot-password`.

### Adding a new sub-router

1. Create the file: `backend/src/routes/authNewFeature.ts`
2. Export the router:

```ts
import { Router } from 'express';
const NewFeatureRouter = Router();

NewFeatureRouter.get('/do-something', async (req, res) => {
  res.json({ ok: true });
});

export default NewFeatureRouter;
```

3. Import and mount in `auth.ts`:

```ts
import NewFeatureRouter from './authNewFeature.js';

AuthRouter.use("/NewFeatureRouter", NewFeatureRouter);
```

### Adding a new top-level domain (non-auth)

1. Create the router file (e.g., `backend/src/routes/notifications.ts`)
2. Import and mount in `server.js`:

```js
import NotificationsRouter from "./src/routes/notifications";
app.use("/api/notifications", NotificationsRouter);
```

---

## 7. Endpoint Map

All auth endpoints follow the pattern: `POST /api/auth/{RouterName}/{endpoint}`

| HTTP Method | Full Path | Sub-Router | File |
|---|---|---|---|
| POST | `/api/auth/EmailVerificaitonRouter/check-password` | AuthEmailVerificaitonRouter | `authEmailVerification.ts` |
| POST | `/api/auth/EmailVerificaitonRouter/signup` | AuthEmailVerificaitonRouter | `authEmailVerification.ts` |
| POST | `/api/auth/EmailVerificaitonRouter/login` | AuthEmailVerificaitonRouter | `authEmailVerification.ts` |
| POST | `/api/auth/EmailVerificaitonRouter/logout` | AuthEmailVerificaitonRouter | `authEmailVerification.ts` |
| GET | `/api/auth/TokenVerificaitonRouter/session` | AuthTokenVerificaitonRouter | `authTokenVerification.ts` |
| POST | `/api/auth/TokenVerificaitonRouter/refresh` | AuthTokenVerificaitonRouter | `authTokenVerification.ts` |
| POST | `/api/auth/UserVerificaitonRouter/verify` | AuthUserVerificaitonRouter | `authUserVerification.ts` |
| POST | `/api/auth/UserVerificaitonRouter/resend-verification` | AuthUserVerificaitonRouter | `authUserVerification.ts` |
| GET | `/api/auth/WsTicketRouter/ws-ticket` | WsTicketRouter | `wsTicket.ts` |
| GET | `/api/health` | (none) | `server.js` |
| GET | `/health/db` | (none) | `server.js` |
| GET | `/metrics` | (none) | `server.js` |
| GET | `/api/chats/` | ChatRouter | `chat/chat.ts` |
| GET | `/api/chats/:chatId/messages` | ChatRouter | `chat/chat.ts` |
| POST | `/api/chats` | ChatRouter | `chat/chat.ts` |
| POST | `/api/chats/:chatId/:userId/appendMessage` | ChatRouter | `chat/chat.ts` |
| PATCH | `/api/chats/:chatId/messages/:messageId/:userId` | ChatRouter | `chat/chat.ts` |
| DELETE | `/api/chats/:chatId/messages/:messageId/:userId` | ChatRouter | `chat/chat.ts` |
| GET | `/api/users/*` | UserRouter | `routes/users.ts` |
| POST | `/api/friends/send` | FriendRouter | `routes/userAddFriend.ts` |
| PATCH | `/api/friends/accept` | FriendRouter | `routes/userAddFriend.ts` |
| PATCH | `/api/friends/:id/decline` | FriendRouter | `routes/userAddFriend.ts` |
| GET | `/api/notifications` | NotificationRouter | `routes/userNotification.ts` |
| PATCH | `/api/notifications/:id/read` | NotificationRouter | `routes/userNotification.ts` |
| PATCH | `/api/notifications/read-all` | NotificationRouter | `routes/userNotification.ts` |
| GET | `/api/anonymousChats` | AnonymousChatRouter | `routes/anonymousChat.ts` |
| GET | `/api/anonymousChats/:id` | AnonymousChatRouter | `routes/anonymousChat.ts` |
| POST | `/api/anonymousChats/:id/join` | AnonymousChatRouter | `routes/anonymousChat.ts` |
| GET | `/api/anonymousChats/:id/messages` | AnonymousChatRouter | `routes/anonymousChat.ts` |
| POST | `/api/anonymousChats/:id/messages/:userId/:isAnonymous` | AnonymousChatRouter | `routes/anonymousChat.ts` |
| PATCH | `/api/anonymousChats/:id/messages/:messageId` | AnonymousChatRouter | `routes/anonymousChat.ts` |
| DELETE | `/api/anonymousChats/:id/messages/:messageId` | AnonymousChatRouter | `routes/anonymousChat.ts` |
| POST | `/api/anonymousChats/:id/messages/:messageId/upvote` | AnonymousChatRouter | `routes/anonymousChat.ts` |
| POST | `/api/anonymousChats/:id/messages/:messageId/downvote` | AnonymousChatRouter | `routes/anonymousChat.ts` |

---

## Architecture Summary

```
server.js
  │
  ├── Global middleware (JSON, CORS, cookies, CSRF, helmet)
  │
  ├── /api/auth ──► auth.ts
  │                   ├── /EmailVerificaitonRouter ──► authEmailVerification.ts
  │                   ├── /TokenVerificaitonRouter   ──► authTokenVerification.ts
  │                   ├── /UserVerificaitonRouter    ──► authUserVerification.ts
  │                   └── /WsTicketRouter            ──► wsTicket.ts
  │
  ├── /api/chats ──► chat.ts
  ├── /api/users ──► routes/users.ts
  ├── /api/friends ──► routes/userAddFriend.ts
  ├── /api/notifications ──► routes/userNotification.ts
  ├── /api/anonymousChats ──► routes/anonymousChat.ts
  │
  ├── /api/health
  ├── /health/db
  └── /metrics
```

- **`server.js`** — Server config, middleware stack (helmet, CORS, CSRF), router mounting. Never defines route handlers (except health/metrics).
- **`auth.ts`** — Router hub. Only mounts sub-routers. Never defines route handlers.
- **Sub-routers** — Define route handlers for a specific domain (email auth, token auth, user verification, WS tickets).
- **Services** — Pure business logic (password hashing, JWT signing, rate-limiting, messaging). No HTTP awareness.
