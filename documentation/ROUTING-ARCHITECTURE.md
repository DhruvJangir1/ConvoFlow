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
     ┌─────────┼──────────┐
     ▼         ▼          ▼
  (direct)  WsTicket   (future
  /setup-   Router     sub-
  user                  routers)
            ─────────
            /ws-ticket
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
- `GET` requests (like `/ws-ticket`) skip this check.

### Router Mounting

```js
app.use("/api/auth", AuthRouter);           // All auth-related routes
app.use("/api/chats", ChatRouter);          // Chat CRUD and messaging
app.use("/api/users", UserRouter);          // User profile operations
app.use("/api/friends", FriendRouter);      // Friend request management
app.use("/api/notifications", NotificationRouter); // Notification management
app.use("/api/anonymousChats", AnonymousChatRouter); // Anonymous chat rooms
app.get("/api/health", ...);                // Health check (no router)
```

> **Key point:** `server.js` never defines route handlers directly (except health). It only mounts routers. This keeps the file thin and focused on server configuration. In production it also serves the Vite `dist/` build with an SPA fallback (any non-`/api` path returns `index.html`).

---

## 3. auth.ts — The Router Hub

**File:** `backend/src/routes/auth.ts`

`auth.ts` is not a pure route handler file. It is a **router hub** that defines a small number of auth routes directly and mounts sub-routers under `/api/auth`.

### Current Mounts

```ts
import WsTicketRouter from './wsTicket.js';

const AuthRouter = Router();

AuthRouter.post('/setup-user', authenticate, async (req: Request, res: Response): Promise<void> => {
  // returns the DB user for the current Clerk session
});

AuthRouter.use("/WsTicketRouter", WsTicketRouter);
```

When you mount a sub-router with a prefix like `/WsTicketRouter`, Express prepends that prefix to every route defined inside the sub-router.

For example, if `WsTicketRouter` defines `get('/ws-ticket', ...)`, the full path becomes `/api/auth/WsTicketRouter/ws-ticket`.

> **Key concept:** `Router.use()` merges routes from sub-routers. It does NOT create a new path segment unless you give it a prefix string.

### Design Philosophy

- **`auth.ts` is a small hub.** It defines `setup-user` directly and wires sub-routers together.
- **Adding a new sub-router** means: (1) create the file, (2) import it in `auth.ts`, (3) mount with `Router.use()`.
- **Removing a sub-router** means: remove the `use()` line and the import.

---

## 4. Sub-Routers — Route Files

Each sub-router file is a standard Express `Router` that defines its own handlers and exports the router as default. `auth.ts` also defines one route directly (`setup-user`).

### a. AuthRouter direct route (`/api/auth/setup-user`)

| Route | Method | Handler Responsibility |
|---|---|---|
| `/setup-user` | POST | Eager user creation — returns the DB user for the current Clerk session |

**Middleware:** `authenticate` (verifies the Clerk JWT and sets `req.user`).

### b. WsTicketRouter (`/api/auth/WsTicketRouter/*`)

**File:** `backend/src/routes/wsTicket.ts`

| Route | Method | Handler Responsibility |
|---|---|---|
| `/ws-ticket` | GET | Generates a one-time WebSocket authentication ticket |

**Key services used:**
- `services/wsTicketStore.ts` — `generateTicket`

Generates a UUID ticket with a 60-second TTL stored in an in-memory Map. The client uses this ticket to authenticate the WebSocket connection at `ws://<host>/ws?ticket=<ticket>` (same HTTP server as the API).

---

## 5. Complete Request Flow

Here is an example of an authenticated request to trace the full path:

### `GET /api/auth/WsTicketRouter/ws-ticket`

```
Step 1: Vite Dev Proxy
─────────────────────────────────────────────────────────
  The React frontend calls clerkFetch('/api/auth/WsTicketRouter/ws-ticket'),
  which attaches Authorization: Bearer <clerk-jwt>.
  Vite's proxy (vite.config.ts) forwards this to http://localhost:3000.

Step 2: server.js
─────────────────────────────────────────────────────────
  a. express.json()        — parses the request body into req.body
  b. helmet()              — sets HTTP security headers
  c. cors()                — adds CORS headers (credentials: true)
  d. urlencoded + cookieParser — parses cookies into req.cookies
  e. CSRF middleware       — validates Origin/Referer header (GET = skipped)
  f. Router dispatch       — matches "/api/auth" → forwards to AuthRouter

Step 3: auth.ts (Router Hub)
─────────────────────────────────────────────────────────
  AuthRouter.use("/WsTicketRouter", ...)  — matches prefix
  → forwards to WsTicketRouter

Step 4: wsTicket.ts (Route Handler)
─────────────────────────────────────────────────────────
  GET '/ws-ticket'
    1. authenticate middleware extracts Bearer token from
       Authorization header via /^Bearer\s+(.+)$/i
    2. verifyClerkToken(token) → { sub: clerkId }  (lib/auth.ts wrapper)
    3. prisma lookups by clerk_id → req.user = { id: dbUuid, email }
       (auto-provisions the DB user if it doesn't exist yet)
    4. generateTicket(req.user.id) — UUID ticket with 60s TTL
       stored in an in-memory Map
    5. Returns { ticket } — JSON response

Step 5: Response sent back to client
─────────────────────────────────────────────────────────
  JSON body → { ticket: "<uuid>" }
  (client then opens ws://<host>/ws?ticket=<ticket>)
```

---

## 6. Mounting New Routes

### Adding a new endpoint to an existing sub-router

Open the relevant sub-router file and add the route:

```ts
AuthRouter.post('/setup-user', authenticate, async (req, res) => {
  // handler logic
});
```

The endpoint will automatically be available at `/api/auth/setup-user`.

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

All auth endpoints are mounted under `/api/auth`.

| HTTP Method | Full Path | Sub-Router | File |
|---|---|---|---|
| POST | `/api/auth/setup-user` | AuthRouter (direct) | `auth.ts` |
| GET | `/api/auth/WsTicketRouter/ws-ticket` | WsTicketRouter | `wsTicket.ts` |
| GET | `/api/health` | (none) | `server.js` |
| POST | `/api/chats` | ChatRouter | `chat/chat.ts` |
| GET | `/api/chats` | ChatRouter | `chat/chat.ts` |
| POST | `/api/chats/:chatId/image` | ChatRouter | `chat/chat.ts` |
| GET | `/api/chats/:chatId/messages` | ChatRouter | `chat/chat.ts` |
| POST | `/api/chats/:chatId/:userId/appendMessage` | ChatRouter | `chat/chat.ts` |
| PATCH | `/api/chats/:chatId/messages/:messageId/:userId` | ChatRouter | `chat/chat.ts` |
| DELETE | `/api/chats/:chatId/messages/:messageId/:userId` | ChatRouter | `chat/chat.ts` |
| GET | `/api/users/search` | UserRouter | `routes/users.ts` |
| PATCH | `/api/users/profile-image` | UserRouter | `routes/users.ts` |
| PATCH | `/api/users/:userId/update-bio` | UserRouter | `routes/users.ts` |
| GET | `/api/users/:userId/fetch-chatNames` | UserRouter | `routes/users.ts` |
| POST | `/api/friends/send` | FriendRouter | `routes/userAddFriend.ts` |
| PATCH | `/api/friends/accept` | FriendRouter | `routes/userAddFriend.ts` |
| PATCH | `/api/friends/:id/reject` | FriendRouter | `routes/userAddFriend.ts` |
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
| POST | `/api/anonymousChats/:messageId/upvote` | AnonymousChatRouter | `routes/anonymousChat.ts` |
| POST | `/api/anonymousChats/:messageId/downvote` | AnonymousChatRouter | `routes/anonymousChat.ts` |

---

## Architecture Summary

```
server.js
  │
  ├── Global middleware (JSON, CORS, cookies, CSRF, helmet)
  │
  ├── /api/auth ──► auth.ts
  │                   ├── /setup-user (direct route)
  │                   └── /WsTicketRouter ──► wsTicket.ts
  │
  ├── /api/chats ──► chat.ts
  ├── /api/users ──► routes/users.ts
  ├── /api/friends ──► routes/userAddFriend.ts
  ├── /api/notifications ──► routes/userNotification.ts
  ├── /api/anonymousChats ──► routes/anonymousChat.ts
  │
  └── /api/health
```

- **`server.js`** — Server config, middleware stack (helmet, CORS, CSRF), router mounting. Never defines route handlers (except health).
- **`auth.ts`** — Router hub. Defines `setup-user` directly, mounts sub-routers (WS tickets).
- **Sub-routers** — Define route handlers for a specific domain (WS tickets, chats, friends, etc.).
- **Services** — Pure business logic (Clerk JWT verification, rate-limiting, messaging, image upload). No HTTP awareness.
