# ConvoFlow — Agent Instructions

# System Prompt: gstack Flow Behavioral Framework

You are an advanced LLM coding agent operating within the **gstack** ecosystem. You must strictly execute tasks according to the behavioral rules, iterative pipelines, and tool constraints defined in `image.png`. Do not write code for speculative features, and do not bypass verification steps.

---

## The 6 Core Rules

1. **Think Before Coding**: Avoid raw assumptions. Force clarity on tradeoffs early.
2. **Simplicity First**: Write the absolute minimum layout needed. Eliminate structural bloat.
3. **Surgical Changes**: Restrict modifications exclusively to the target scope. Do not touch adjacent layers.
4. **Goal-Driven Execution**: Define clear, deterministic success criteria prior to execution. Verify continuously.
5. **Harness**: Establish the definition of "Done" and enforce systematic verification techniques.
6. **Loops & Autonomy**: Execute programmatic, bounded iteration loops. Halt immediately upon hitting safety thresholds.

---

## Operational Workflow Pipeline

### Phase 1: Think Before Coding
Before generating any engineering output or modifications:
*   Formulate and state your explicit assumptions. Ask for confirmation if ambiguity exists.
*   Present multiple alternative implementations or interpretations of the requirement.
*   Proactively call out simpler, less complex alternatives.
*   Stop execution entirely if the goal is unclear. Isolate and name the exact points of confusion for the user.

### Phase 2: Simplicity First & TypeScript Code Quality
When planning structures, typing systems, or algorithmic modifications:
*   Adopt the minimal path that satisfies the criteria. Avoid extras or speculative features.
*   Reject unnecessary abstractions or premature optimization.
*   **Condensation Mandate**: If a sequence can be written in a significantly more compact form (e.g., reducing 200 lines down to 50 lines), rewrite it entirely for clarity and brevity.
*   **TypeScript & ESLint Safety Rules**:
    *   **Strict Typing**: Never use the `any` type under any circumstances.
    *   **No Unsafe Chaining/Assertions**: Do not use optional chaining (`?.`) or non-null assertions (`!.`) to bypass types (e.g., avoid `x?.a` and `req.user!.id`).
    *   **Early Guard Clauses**: Explicitly handle missing properties using structured early returns (e.g., write `if (!req.user) return;` rather than asserting existence or chaining).
    *   **No Coercion/Fallback Operators**: Avoid using double-bang (`!!`) or nullish-coalescing (`??.`) shortcuts to mask type uncertainties.
    *   **No Linter Suppression**: Never insert `/* eslint-disable ... */`, `// eslint-disable-next-line`, or `@ts-ignore` comments to silence compiler errors. Fix the underlying type architecture instead.

### Phase 3: Surgical Changes
When interfacing with an active environment:
*   Isolate the exact target files or blocks. Do not refactor or clean up adjacent, unrelated elements.
*   Adapt to and strictly replicate the surrounding style, patterns, and design paradigms.
*   Fix only what your explicit changes directly alter or break.

### Phase 4: Goal-Driven Execution
Formulate a strict validation plan prior to running automation loops. Map every operational step to a concrete verification check:
1. `[Step]` → `verify: [check]`
2. `[Step]` → `verify: [check]`

### Phase 5: Harness Constraints
*   **Verification Core**: Every outcome must be verified against a concrete rendering target or runtime validation engine.
*   **Validation Rule**: Ensure all generated markups, layouts, or program outputs pass standard protocol validations.

### Phase 6: Loops & Autonomy
When running autonomous execution or debugging operations, structure your commands using strict execution primitives (e.g., `/goal`, `/loop`, `/batch`).
*   **Branch Isolation**: All operations must occur on an active git branch.
*   **Iteration Boundaries**: You must establish a rigid iteration cap before invoking an autonomous loop.
*   **Verification-Gated**: Loops are allowed only when backed by programmatic, objective validation checks.
*   **Heuristic Restriction**: Never leverage autonomous loops for high-judgment, creative, or architectural decisions.
*   **Escalation Protocol**: If the iteration threshold is reached without reaching a resolution: immediately stop execution, synthesize a summary of attempted vectors, and return control to the user with actionable options.

---

## Tooling & Skill Execution Constraints

When choosing execution paths from the available gstack toolset:
*   **Browsing Engine**: Utilize only the native `/browse` environment for runtime and network verification tasks.
*   **Strict Tool Block**: Do not invoke or execute any commands via `mcp__claude-in-chrome__*` tools under any circumstances.

---

## Project Structure — Two-Package Layout

ConvoFlow is a **monorepo with two separate packages**:
- **Root (`/`)**: The React frontend (Vite, TypeScript, Tailwind CSS)
- **`backend/`**: The Express backend server (TypeScript via `tsx` runtime)

Each package has its own `package.json`, `node_modules/`, and `tsconfig.json`. They are completely independent in terms of dependency management. Running `npm install` at the root automatically triggers `npm --prefix backend install` via a `postinstall` script defined in the root `package.json`.

### Frontend Directory Tree

```
src/
├── main.tsx                  # React entry point — wraps App in ClerkProvider + providers
├── App.tsx                   # React Router route definitions
├── index.css                 # Global styles + Tailwind imports
├── auth/                     # Authentication UI (Clerk-powered login/signup + legacy verification)
│   ├── LoginForm.tsx         # Wraps Clerk <SignIn> with dark-theme appearance overrides
│   ├── SignUpForm.tsx        # Wraps Clerk <SignUp> with dark-theme appearance overrides
│   ├── VerificationPage.tsx  # Email verification (6-digit code) — legacy route, kept for compatibility
│   └── passwordValidator.ts  # Password strength checker — legacy, not used by Clerk flows
├── components/               # Shared reusable UI components
│   ├── AddFriendButton.tsx
│   ├── ChatHeader.tsx        # Top bar of a chat (name, avatar, online status)
│   ├── ChatInput.tsx         # Message composer (text + image paste + anonymous toggle)
│   ├── GroupInfoModal.tsx    # Group chat member list
│   ├── MessageList.tsx       # Core message renderer (text, images, voting, edit/delete)
│   ├── ProtectedRoute.tsx    # Route guard — spinner while loading, redirect to /login if no user
│   └── UserAvatar.tsx
├── context/                  # React Context providers (global state that lives across route changes)
│   ├── AuthContext.tsx        # Syncs Clerk user to Redux — reads useUser()/useAuth() from Clerk
│   ├── ChatContext.tsx        # Fetches + syncs chat list to Redux, auto-subscribes WS rooms
│   └── WebSocketContext.tsx   # WS connection lifecycle, subscribe queue, message dispatch (uses clerkFetch)
├── hooks/                    # Custom React hooks (data fetching + mutations via TanStack Query)
│   ├── useChatsQuery.ts
│   ├── useChatMessagesQuery.ts
│   ├── useChatDetailQuery.ts
│   ├── useChatMutations.ts   # Send, edit, delete, create chat mutations
│   ├── useNotificationsQuery.ts
│   ├── useNotificationMutations.ts
│   ├── useAnonymousRoomsQuery.ts
│   ├── useAnonymousRoomQuery.ts
│   ├── useAnonymousMessagesQuery.ts
│   └── useAnonymousMutations.ts
├── layouts/                  # Layout components (structural wrappers for pages)
│   ├── RootLayout.tsx        # Wraps protected routes in Sidebar + ChatList + providers
│   ├── ShellLayout.tsx
│   ├── Sidebar.tsx
│   ├── ChatList.tsx          # Chat sidebar — lists regular + anonymous chats
│   └── Navbar.tsx            # Top nav — uses useClerk().signOut() for logout
├── lib/                      # Shared utility modules
│   ├── clerkFetch.ts         # Wraps fetch() to inject Clerk JWT as Authorization header
│   ├── queryKeys.ts          # TanStack Query cache key factories
│   └── dateFormat.ts
├── modals/                   # Modal dialog components
│   ├── ConfirmModal.tsx
│   ├── ImageModal.tsx
│   ├── ProfileModal.tsx      # Uses useClerk().signOut() for logout
│   ├── ProfileImageModal.tsx
│   ├── UserSearchModal.tsx
│   ├── AddFriendModal.tsx
│   ├── AddNewFriendModal.tsx
│   ├── FriendRequestModal.tsx
│   └── AcceptLoadingModal.tsx
├── pages/                    # Route-level page components
│   ├── LandingPage.tsx       # / — marketing page (auto-redirects if logged in)
│   ├── WelcomePage.tsx       # /welcome
│   ├── Home.tsx              # /home — chat list / feed
│   ├── ChatView.tsx          # /chat/:chatId — standard chat
│   ├── Communities.tsx       # /communities
│   ├── ProfileView.tsx       # /profile
│   ├── NotificationsPage.tsx # /notification
│   ├── NotFoundPage.tsx      # 404
│   └── AnonymousChats/
│       ├── AnonymousChat.tsx
│       ├── AnonymousChatComposer.tsx
│       └── AnonymousChatHeader.tsx
├── store/                    # Redux Toolkit slices (global UI state)
│   ├── store.ts              # configureStore — combines slices
│   ├── userAuthSlice.tsx     # user, isConnected, unreadNotifCount
│   └── chatSlice.tsx         # chats list, onlineUsers per chat
└── types/                    # Shared TypeScript type definitions
    ├── chat.ts               # Chat, ChatMessages, AnonymousChatMessages, etc.
    └── WsMessageNotification.ts  # WSMessage discriminated union type
```

### Backend Directory Tree

```
backend/
├── server.js                 # Express entry point — mounts middleware, routes, WS, static serving
├── src/
│   ├── config/
│   │   └── supabase.ts       # Supabase client config (still used for S3 image storage)
│   ├── lib/
│   │   ├── auth.ts                 # Clerk abstraction layer — verifyClerkToken(), fetchClerkUser()
│   │   ├── connectionPoolClient.ts # Prisma client instance
│   │   ├── calculatePoolSize.ts
│   │   ├── databaseClusterClass.ts
│   │   ├── gracefulShutDown.ts
│   │   ├── healthCheckPool.ts
│   │   ├── multiTenantPool.ts
│   │   ├── promtheusTime.ts
│   │   └── queuedPoolClass.ts
│   ├── middleware/
│   │   ├── authenticate.ts   # Auth middleware — uses lib/auth.ts wrapper (no direct Clerk imports)
│   │   └── validateOrigin.ts # CSRF protection — checks Origin/Referer on mutating requests
│   ├── routes/
│   │   ├── auth.ts           # Router hub — mounts WsTicketRouter + UserVerificationRouter only
│   │   ├── authUserVerification.ts    # POST /verify, /resend-verification (kept for compatibility)
│   │   ├── wsTicket.ts               # GET /ws-ticket (generates one-time WS auth ticket)
│   │   ├── users.ts                  # GET /search, PATCH /profile-image
│   │   ├── userAddFriend.ts          # POST /send, PATCH /accept, /reject
│   │   ├── userNotification.ts       # GET /, PATCH /:id/read, /read-all
│   │   ├── anonymousChat.ts          # Full CRUD for anonymous chat rooms + messages
│   │   └── imageUpload.ts            # Base64 image upload (standalone, not mounted)
│   ├── services/
│   │   ├── authVerificaiton.ts    # Email verification via Gmail SMTP (Nodemailer) — sends codes
│   │   ├── dmChat.ts         # findDmChat / createDmChat helpers
│   │   ├── imageUpload.ts    # S3 upload via Supabase, presigned URL generation
│   │   ├── rateLimiter.ts    # Redis-backed rate limiter with in-memory fallback
│   │   ├── userMessageVote.ts # Upvote/downvote logic for anonymous messages
│   │   ├── userNotify.ts     # Notification creation + WS push
│   │   ├── verificationStore.ts  # In-memory verification code store
│   │   └── wsTicketStore.ts  # In-memory WS ticket store (60s TTL)
│   ├── supabase/
│   │   ├── admin.ts          # Supabase admin client (service role — used for S3)
│   │   └── supabaseS3Client.ts  # S3-compatible client for image storage
│   ├── chat/
│   │   ├── chat.ts           # Standard chat routes (CRUD, messages, image upload)
│   │   └── chatImageHelpers.ts  # signChatAvatar, signMemberImages, signSenderImage
│   └── util/
│       └── constants.ts      # PRISMA_SAFE_SELECT, VERIFICATION_TTL_MS, FRIEND_MAX_PENDING_OUTGOING
├── ws/
│   ├── websocket.ts          # WebSocket server — auth via ticket, rooms, message broadcast, typing
│   └── websockets.test.ts    # WebSocket unit tests
├── redis/
│   └── redisClient.ts        # Upstash Redis REST client
└── dtos/
    ├── UserResponseDTO.ts
    └── UserSignupRequstDTO.ts
```

---

## Startup — How to Run Locally

### Prerequisites

- **Node.js** >= 20
- **PostgreSQL** >= 14
- **npm** (v9+)
- **Redis** (optional — rate limiter falls back to in-memory if unavailable)

### Step-by-Step

```bash
# 1. Install all dependencies (root + backend via postinstall)
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Start the backend server (tsx watch, auto-restarts on changes, port 3000)
cd backend && npm run dev

# 4. In a SEPARATE terminal — start the frontend dev server (Vite, port 5173)
npm run dev
```

### How the Dev Servers Connect

The Vite dev server (port 5173) acts as the user's browser entry point. When the React app makes API calls to `/api/...`, Vite's built-in dev proxy forwards them to `http://localhost:3000` (the Express backend). This is configured in `vite.config.ts`:

```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:3000', changeOrigin: true }
  }
}
```

The `changeOrigin: true` option rewrites the `Host` header so Express sees the request as coming from localhost:3000.

**WebSocket server** runs separately on the path `/ws` on the same HTTP server (not a separate port anymore in production). The client connects after getting a one-time ticket via `clerkFetch`.

---

## Build & Deploy

### Build Command

```bash
npm run build
```

This runs three steps in sequence:
1. `npx prisma generate` — regenerates the Prisma client from `prisma/schema.prisma`
2. `npx tsc -b` — TypeScript compilation using project references
3. `vite build` — bundles the React app into `dist/` (with `NODE_OPTIONS=--max-old-space-size=384` for memory)

### Production Start

```bash
npm start
```

This runs the build first, then starts the backend which serves `dist/` as static files. All routes that don't match `/api/...` or `/ws` return `index.html` (SPA fallback via `app.get('*path')`).

### Production Environment Variables

```env
NODE_ENV=production
CORS_ORIGIN=https://convo-flow-4eu6.vercel.app   # MUST be a real URL, no wildcards
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
CLERK_SECRET_KEY=sk_test_...                      # Clerk backend secret key
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...            # Clerk frontend publishable key (Vite env)
EMAIL_USER=your.email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
SUPABASE_S3_BUCKET_ENDPOINT=...
SUPABASE_S3_ACCESS_KEY_ID=...
SUPABASE_S3_SECRET_ACCESS_KEY=...
SUPABASE_S3_BUCKET_NAME=...
```

### Current Deployment

- **Frontend**: Vercel at `https://convo-flow-4eu6.vercel.app`
- **Backend**: Render at `https://convoflow-2.onrender.com`
- **Vercel rewrites**: `/api/:path*` → Render backend (forwards path correctly)
- **CORS_ORIGIN** on Render: `https://convo-flow-4eu6.vercel.app`
- **VITE_WS_URL** on Vercel: `wss://convoflow-2.onrender.com/ws`

---

## Testing

### Available Commands

```bash
# Root (frontend)
npm run test-jest       # Jest (config has testMatch: [] — disabled)
npm run test-vitest     # Vitest

# Backend
cd backend && npm run test-jest
cd backend && npm run test-vitest   # Primary test runner
```

**Vitest is the primary test runner.** Jest at root has `testMatch: []` which disables all tests — this is intentional pre-existing config.

### Running Backend Tests

```bash
cd backend && npx vitest run
```

Test files:
- `backend/ws/websockets.test.ts` — WebSocket connection, auth, subscribe, broadcast, send, typing, disconnect, error handling (35 tests)
- `backend/src/middleware/authenticate.test.ts` — Auth middleware: token verification, user lookup, auto-provisioning, error paths (11 tests)

### Lint & Typecheck

```bash
npm run lint            # ESLint (typescript-eslint + react-hooks + react-refresh)
npx tsc -b              # TypeScript project references build
```

**Frontend TypeScript is strict** with these `tsconfig.app.json` flags:
- `noUnusedLocals: true` — no unused variables
- `noUnusedParameters: true` — no unused function params
- `verbatimModuleSyntax: true` — explicit `import type` required
- `erasableSyntaxOnly: true` — no `enum`/`namespace` (use `as const` or union types)

---

## Testing Patterns & Gotchas

### WebSocket Tests (`backend/ws/websockets.test.ts`)

- `setupWsAndConnect()` is **async** — the connection handler in `websocket.ts` is async. Event listeners (`pong`, `message`, `close`, `error`) are registered and `userSockets.set(userId, ws)` is called **before** the `await prisma.users.findUnique()` DB lookup, ensuring the socket is immediately available. Always `await` it.
- The `vi.mock('ws')` mock for `WebSocketServer` must use a **regular `function`** (not an arrow) in `mockImplementation` so it can be called with `new`. Arrow functions are not constructable.
- The mock WSS instance is accessed via the hoisted `getMockWss()` helper. When simulating a new connection, emit `'connection'` on the WSS mock (not on the individual ws instance), since that's where the handler is registered:
  ```ts
  const { wss } = getMockWss();
  wss.emit('connection', ws, { url: `/ws?ticket=${ticket}` });
  ```
- `broadcastToRoom()` uses the internal `chatRooms` Map (populated via the `subscribe` message flow), not `ws.subscribedRooms`. To test broadcasting, emit subscribe messages rather than manually adding to `subscribedRooms`.
- The `chatRooms` and `userSockets` Maps are module-level and persist across tests within a single file run. Use unique `chatId`/`userId` values across tests to avoid cross-test contamination.

### S3 Client Mock Requirement

- `backend/src/supabase/supabaseS3Client.ts` **throws at module load** when S3 env vars (`SUPABASE_S3_BUCKET_ENDPOINT`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY`) are missing. Any test that transitively imports `imageUpload.ts` (via `users.ts`, etc.) must mock it:
  ```ts
  vi.mock('../supabase/supabaseS3Client.js', () => ({
    s3Client: {},
    S3_BUCKET_NAME: 'test-bucket',
  }));
  ```
- Place the mock **before** any imports that could reach `imageUpload.ts`.

### Auth Middleware Tests (`backend/src/middleware/authenticate.test.ts`)

- Mock `../lib/auth.js` (the Clerk abstraction layer), NOT `@clerk/backend` directly. This is the whole point of the abstraction — tests never need to know about Clerk.
- Mock `../lib/connectionPoolClient.js` for Prisma calls (`prisma.users.findFirst`, `prisma.users.create`, `prisma.clerkUsers.upsert`).
- Mock `../supabase/admin.js` for `getAdminClient()` (Supabase auth user creation).
- The test covers all code paths: missing header, bad token, existing user by clerk_id, link by email, auto-provision, tag collision, and error cases.

---

## Prisma

- **Schema**: `prisma/schema.prisma` (PostgreSQL, two schemas: `auth` + `public`)
- **Generated client**: `src/generated/prisma/` (not `node_modules/.prisma/`)
- **CLI config**: `prisma.config.ts` (uses `VITE_DIRECT_URL` or `DATABASE_URL`)
- **Generate**: `npx prisma generate` before first dev build
- **Migrations**: Manual SQL in `prisma/migrations/` (not auto-applied — run via psql or DB GUI)
- **Cross-schema**: Models have `@@schema("auth")` and `@@schema("public")` — cross-schema queries work via the generated client
- **RLS**: Row-Level Security is enabled on most models (requires additional migration setup)

### Database Models (Public Schema)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `USERS` | User accounts | id, user_name, email, user_tag, image_url, is_verified, role |
| `StandardChats` | Chat rooms (DM or group) | id, type (dm/group), name, avatar_url, created_by, updated_at |
| `StandardChatMembers` | Chat membership | chat_id, user_id (composite PK), joined_at, last_read_at |
| `StandardChatMessages` | Chat messages | id, chat_id, sender_id, content, message_type (text/image), is_edited, created_at, status |
| `Notifications` | User notifications | id, receiver_user_id, sender_user_id, type, content, read_at, entity_id |
| `AddFriendRequests` | Friend requests | id, sender_id, receiver_id, status (pending/accepted/rejected) |
| `AnonymousChats` | Anonymous chat rooms | id, name, avatar_url, updated_at |
| `AnonymousChatMembers` | Anonymous room membership | id, chat_id |
| `AnonymousChatMessages` | Anonymous messages | id, chat_id, sender_id, content, isAnonymous, TotalUpvotes, is_edited |
| `AnonymousChatMessagesUserVotes` | Vote records | user_id, message_id, type (upvote/downvote) |
| `DailyPolls` | Poll feature | id, question, option1-4 |
| `UserPollVotes` | Poll votes | poll_id, voter_id, optionSelected |

> **Note**: The `USERS` table previously stored `password`, `refresh_token_hash`, `refresh_token_expiry` for the custom auth system. These fields are no longer used after the Clerk migration. A `clerk_id` column has been added to map Clerk user IDs to internal UUIDs.

---

## Key Architecture — How Everything Connects

### Express Entry Point (`backend/server.js`)

The backend runs as an ESM Node.js process. `server.js` is a plain `.js` file that imports `.ts` files via `tsx` (TypeScript execution without compilation).

**Middleware stack (applied in order):**

1. `express.json()` — parses JSON request bodies
2. `helmet({...})` — 13 HTTP security headers (CSP, HSTS, frameguard, etc.)
3. `trust proxy = true` — trusts reverse proxy for `req.ip` (needed for rate limiting behind Vercel/Render)
4. `cors({ origin, credentials })` — allows specific origin with cookies
5. `express.urlencoded({ extended: true })` — parses URL-encoded bodies
6. `cookieParser()` — parses cookies into `req.cookies`
7. `validateOrigin` — CSRF protection: checks `Origin`/`Referer` headers on POST/PUT/PATCH/DELETE

**Route mounts:**

| Mount Path | Router | Source File |
|------------|--------|-------------|
| `/api/auth` | `AuthRouter` | `routes/auth.ts` (hub — mounts WsTicket + UserVerification only) |
| `/api/chats` | `ChatRouter` | `chat/chat.ts` |
| `/api/users` | `UserRouter` | `routes/users.ts` |
| `/api/friends` | `FriendRouter` | `routes/userAddFriend.ts` |
| `/api/notifications` | `NotificationRouter` | `routes/userNotification.ts` |
| `/api/anonymousChats` | `AnonymousChatRouter` | `routes/anonymousChat.ts` |
| `/api/health` | inline handler | `server.js` |

**After routes:** static file serving from `dist/` with SPA fallback. WebSocket server attached via `setupWebSocket(server)`.

### Frontend Provider Tree (`src/main.tsx`)

```
<ClerkProvider publishableKey={...}>   ← Clerk auth (manages session, <SignIn>/<SignUp> components)
  <QueryClientProvider>                ← TanStack React Query (server state caching)
    <Provider store={store}>           ← Redux Toolkit (client state)
      <AuthProvider>                   ← Syncs Clerk user to Redux via useUser()/useAuth()
        <WebSocketProvider>            ← WS connection lifecycle, subscribe queue, message dispatch
          <App />                      ← React Router routes
        </WebSocketProvider>
      </AuthProvider>
    </Provider>
  </QueryClientProvider>
</ClerkProvider>
```

For protected routes, `RootLayout` wraps children in a **second** `<WebSocketProvider>` and `<ChatProvider>`, shadowing the outer providers for all pages inside `/home`, `/chat/*`, etc.

---

## Auth System — Complete Flow

### How Authentication Works

ConvoFlow uses **Clerk** for authentication. Clerk handles user management, session tokens, sign-in, sign-up, and email verification. The backend verifies Clerk JWTs through a centralized abstraction layer — **`backend/src/lib/auth.ts`** — which is the only file that imports from `@clerk/backend`.

### Key Concepts

- **Clerk manages auth state**: The frontend uses `@clerk/react` hooks (`useUser()`, `useAuth()`, `useClerk()`) to determine if the user is logged in.
- **Backend verifies via JWT**: Every protected API route uses the `authenticate` middleware which extracts the Clerk JWT from the `Authorization: Bearer <token>` header and verifies it server-side via the auth wrapper.
- **No cookies for auth tokens**: Clerk manages its own session cookies transparently. The application never reads or writes auth tokens directly in JavaScript — Clerk handles this.
- **`clerkFetch` utility**: All frontend API calls go through `clerkFetch()` which automatically attaches the Clerk JWT as an `Authorization` header.
- **Abstraction layer**: `lib/auth.ts` is the only backend file that imports `@clerk/backend`. All other backend code goes through this wrapper, making business logic testable without Clerk.

### Clerk Configuration

- **Publishable Key**: Stored as `VITE_CLERK_PUBLISHABLE_KEY` env var (frontend). Used in `main.tsx` to initialize `<ClerkProvider>`.
- **Secret Key**: Stored as `CLERK_SECRET_KEY` env var (backend). Used in `lib/auth.ts` for server-side JWT verification and user lookup.
- **Clerk App ID**: `app_3Gp8IiIOdhiETydkWdX61xgiR7Y`

### Frontend Auth Flow

```
1. ClerkProvider initializes with publishableKey
2. AuthContext uses useUser() and useAuth() from @clerk/react
3. When Clerk session is available:
   a. useUser() returns the Clerk user object
   b. AuthContext builds a User object from Clerk data (id, user_name, email, image_url, etc.)
   c. Dispatches setUser() to Redux — user is now "logged in"
4. When Clerk session ends:
   a. useUser() returns null
   b. AuthContext dispatches setUser(null) — user is now "logged out"
```

### Login/Signup Flow (Clerk)

```
1. User navigates to /login or /signup
2. LoginForm renders Clerk <SignIn routing="path" path="/login" appearance={clerkAppearance} />
3. SignUpForm renders Clerk <SignUp routing="path" path="/signup" appearance={clerkAppearance} />
4. Clerk handles the entire auth flow internally (email/password, social OAuth, MFA, etc.)
5. On successful auth, Clerk creates a session
6. useUser() in AuthContext fires with the new user → Redux state updates → UI re-renders
7. ProtectedRoute sees user in Redux → allows access to protected pages
```

### Logout Flow

```
1. User clicks logout in Navbar or ProfileModal
2. Component calls useClerk().signOut()
3. Clerk destroys the session and clears its internal state
4. useUser() returns null → AuthContext dispatches setUser(null) → Redux clears user
5. ProtectedRoute redirects to /login
```

### `clerkFetch` Utility (`src/lib/clerkFetch.ts`)

Every frontend API call goes through `clerkFetch()`:

```ts
import { clerkFetch } from '../lib/clerkFetch';

const res = await clerkFetch('/api/chats');
```

How it works:
1. `AuthProvider` calls `setGetTokenFn(getToken)` from `useClerkAuth()` on mount
2. `clerkFetch` calls `getTokenFn()` to get the current Clerk JWT
3. Attaches it as `Authorization: Bearer <token>` header
4. Calls `fetch()` with the modified headers and `credentials: 'include'`
5. If `getToken` returns null, logs a warning — the request will likely 401

This means **all 13 frontend files** that make API calls (10 hooks, 2 modals, 1 page) use `clerkFetch` instead of raw `fetch`.

### Authenticate Middleware (`backend/src/middleware/authenticate.ts`)

Every protected API route uses this middleware:

```ts
import { verifyClerkToken, fetchClerkUser } from '../lib/auth.js';

export async function authenticate(req, res, next) {
  // 1. Extract Bearer token from Authorization header
  // 2. If missing → 401 "Authentication required"
  // 3. Call verifyClerkToken(token) → { sub: clerkId }
  // 4. Look up user by clerk_id in DB → set req.user = { id: dbUuid, email } → next()
  // 5. If not found → auto-provision: fetchClerkUser → Supabase auth user → Prisma create
}
```

**Auto-provisioning flow** (when a Clerk user has no DB row):
1. `fetchClerkUser(clerkId)` → gets email from Clerk API
2. Check for existing user by email → link `clerk_id` if found
3. Otherwise: `supabase.auth.admin.createUser()` → `prisma.clerkUsers.upsert()` → `prisma.users.create()`

**Clerk ID vs DB UUID**: Clerk user IDs (e.g., `user_3Gp...`) are **not** UUIDs. The middleware maps them to internal DB UUIDs via the `clerk_id` column on `USERS`. The `req.user.id` is always the DB UUID, never the Clerk ID.

### WebSocket Auth Flow

```
1. Frontend calls GET /api/auth/WsTicketRouter/ws-ticket via clerkFetch (sends Clerk JWT)
2. authenticate middleware verifies the JWT → sets req.user.id
3. Server: generateTicket(req.user.id) → stores userId in in-memory Map with 60s TTL
4. Server returns: { ticket: "<uuid>" }
5. Frontend opens WebSocket: ws://host/ws?ticket=<ticket>
6. WebSocket server: consumeTicket(ticket) → get userId → set ws.userId
7. Server: fetch user profile from DB by userId → set ws.userName, ws.userImage
```

### Logout Flow (Backend)

Since Clerk manages sessions, there is **no backend logout endpoint**. The frontend simply calls `useClerk().signOut()` which:
1. Clerk destroys the session on its servers
2. Frontend AuthContext detects user is gone → clears Redux state
3. No backend call needed — Clerk handles session invalidation

---

## WebSocket System — Complete Flow

### Architecture

The WebSocket server runs attached to the same HTTP server as Express on the `/ws` path. It uses the raw `ws` library.

### Connection Flow

```
1. Client calls GET /api/auth/WsTicketRouter/ws-ticket (via clerkFetch, sends Clerk JWT)
2. Server: authenticate middleware verifies JWT → generateTicket(req.user.id) → UUID string stored in in-memory Map with 60s TTL
3. Client opens: ws://host/ws?ticket=<ticket>
4. WebSocket server: authenticateConnection() → consumeTicket(ticket) → get userId
   a. If invalid/expired → close with code 4001
   b. If valid → set ws.userId, ws.isAlive=true, ws.subscribedRooms=Set()
5. Server: fetch user profile from DB (user_name, image_url) → set ws.userName, ws.userImage
6. Server: register handlers (pong, message, close, error)
7. Server: userSockets.set(userId, ws) → maps userId to their socket
```

### Room System

A "room" is a chat. When a user subscribes to a chat, their socket is added to a Set stored in `chatRooms` Map (keyed by chatId). Messages broadcast to a room are sent to every socket in that Set.

```
Subscribe:
  Client sends: { type: "subscribe", payload: { chatIds: ["id1", "id2"] } }
  Server: for each chatId:
    - chatRooms.get(chatId) ?? new Set() → add ws
    - ws.subscribedRooms.add(chatId)
  Server sends back: { type: "subscribed", payload: { chatIds } }
  Server broadcasts: { type: "user:online", payload: { chatId, userId } } to room
  Server sends: { type: "chat:online-users", payload: { chatId, userIds } } to subscriber

Unsubscribe:
  Client sends: { type: "unsubscribe", payload: { chatIds } }
  Server: for each chatId:
    - chatRooms.get(chatId)?.delete(ws)
    - ws.subscribedRooms.delete(chatId)
  Server broadcasts: { type: "user:offline", payload: { chatId, userId } }
```

### Sending Messages (WebSocket Path — Primary)

```
1. Client sends: { type: "message:send", payload: { chatId, content, tempId? } }
2. Server: validate userId, userName, content
3. Server: prisma.standardChatMessages.create({ chat_id, sender_id, content })
4. Server: prisma.standardChats.update({ updated_at: now })
5. Server sends ACK to sender: { type: "message:ack", payload: { id, tempId } }
6. Server broadcasts to room: { type: "message:new", payload: { id, chatId, senderId,
   senderName, senderImage, content, createdAt, isAnonymous, messageType } }
```

### Sending Messages (REST Path — Fallback)

When WebSocket is disconnected, `ChatInput` falls back to:
```
POST /api/chats/:chatId/:userId/appendMessage { content }
```
This also broadcasts `message:new` to the room via `broadcastToRoom()`.

### Deleting Messages

```
1. Client: DELETE /api/chats/:chatId/messages/:messageId/:userId
2. Server: authenticate → membership check → ownership check → prisma.delete
3. Server broadcasts: { type: "message:delete", payload: { chatId, messageId, senderId, isAnonymous } }
4. All room members remove the message from their UI immediately
```

### Typing Indicators

```
Client sends: { type: "typing:start" | "typing:stop", payload: { chatId } }
Server broadcasts: { type: "typing:update", payload: { chatId, userId, isTyping } }
```

### Disconnect

```
1. Socket closes → handleClose(ws)
2. Server: removeSocketFromAllRooms(ws) → for each room, broadcast "user:offline"
3. Server: userSockets.delete(userId)
```

### Heartbeat

Every 30 seconds, the server pings all connected clients. If a client doesn't respond with pong, `ws.terminate()` kills the zombie connection.

### Client-Side WebSocket (`WebSocketContext.tsx`)

The client maintains:
- `wsRef` — the active WebSocket instance
- `subscribedChatsRef` — Set of chatIds the client has subscribed to
- `messageHandlers` — Set of callback functions for incoming messages

On mount (when `user` becomes available):
1. Fetch ticket from `/api/auth/WsTicketRouter/ws-ticket` via **`clerkFetch`** (sends Clerk JWT)
2. Open WebSocket with ticket
3. On open: send all pending subscriptions from `subscribedChatsRef`
4. On message: parse JSON, dispatch to registered handlers + messageHandlers callbacks
5. On close: schedule reconnect after 2 seconds

---

## Chat System

### Standard Chats (DM + Group)

Standard chats use `StandardChats`, `StandardChatMembers`, and `StandardChatMessages` Prisma models.

**API Routes (`/api/chats`):**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chats` | Create chat (DM or group) |
| GET | `/api/chats` | List user's chats with last message + message count |
| POST | `/api/chats/:chatId/image` | Upload image to chat (multer + S3) |
| GET | `/api/chats/:chatId/messages` | Paginated messages (20 per page, `?before=` cursor) |
| POST | `/api/chats/:chatId/:userId/appendMessage` | Send text message (REST fallback) |
| PATCH | `/api/chats/:chatId/messages/:messageId/:userId` | Edit message |
| DELETE | `/api/chats/:chatId/messages/:messageId/:userId` | Delete message |

All routes use `authenticate` middleware.

**Membership check:** Every chat operation calls `requireChatMembership(userId, chatId)` to verify the user belongs to the chat before allowing access.

### Anonymous Chats

Anonymous chats use separate Prisma models (`AnonymousChats`, `AnonymousChatMembers`, `AnonymousChatMessages`). They have the same WebSocket infrastructure (same `chatRooms` Map) but separate REST routes under `/api/anonymousChats`.

**Features:**
- Messages can be sent anonymously or with identity (`isAnonymous` flag)
- Voting system (upvote/downvote) with toggle logic
- `lastMessage` + `timestamp` in sidebar for real-time ordering

### Image Messages

Images are never stored as base64 in the database. The flow:
1. Client pastes image → `ChatInput` stages it as a `File` object
2. Client sends `POST /api/chats/:chatId/image` with `multipart/form-data` (5MB limit)
3. Backend uploads to Supabase S3 storage → stores the S3 key as `content` in `StandardChatMessages`
4. On every read, the S3 key is converted to a presigned URL (1-hour expiry) via `signImageUrl()`
5. Client never sees raw S3 keys — all image URLs are presigned

**Image signing helpers** (`chat/chatImageHelpers.ts`):
- `signChatAvatar(url)` — signs a chat's avatar_url
- `signMemberImages(members)` — signs all member image_url fields
- `signSenderImage(message)` — signs the sender's image_url in a message payload

---

## Notification System

### Creation

Notifications are created by `notifyFriendRequest()` in `userNotify.ts` using a Prisma `$transaction`:
1. Create `Notifications` record (type: `friend_request`)
2. Create `AddFriendRequests` record (same ID as `entity_id`)

### Real-Time Push

After creation, the server pushes the notification to the receiver via WebSocket:
```
sendToUser(receiverId, { type: "notification:new", payload: notification })
```

### Client Display

1. `WebSocketContext` receives `notification:new` → dispatches `incrementUnreadNotif()` to Redux (badge count)
2. `WebSocketContext` prepends the notification to the TanStack Query cache (`notifKeys.lists()`)
3. `NotificationsPage` renders unread/read sections with accept/decline buttons for friend requests

### Notification Types

| Type | Trigger |
|------|---------|
| `friend_request` | User A sends friend request to User B |
| `friend_request_accepted` | User B accepts the request |
| `friend_request_rejected` | User B rejects the request |

---

## Friend System

### Send Request

```
1. POST /api/friends/send { userTag }
2. Server: look up target user by user_tag
3. Checks: no duplicate pending request, sender hasn't exceeded 10 pending outgoing,
   sender wasn't previously rejected by this target
4. Creates Notification + AddFriendRequest in transaction
5. Sends email via Gmail SMTP (Nodemailer)
6. Pushes notification via WebSocket to receiver
```

### Accept Request

```
1. PATCH /api/friends/accept { notification: { id, sender_user_id } }
2. Server: update AddFriendRequests.status = 'accepted'
3. Server: update original notification type to 'friend_request_accepted'
4. Server: createDmChat(senderId, userId) → creates StandardChats + StandardChatMembers
5. Server: create 'friend_request_accepted' notification for sender
6. Server: push "notification:new" + "chat:new" to both users via WebSocket
   → both users auto-subscribe to the new chat room
```

### Reject Request

```
1. PATCH /api/friends/:id/reject
2. Server: delete AddFriendRequests + original notification
3. Server: create 'friend_request_rejected' notification for sender
4. Server: push via WebSocket
```

---

## Redux Store

### `userAuthSlice` (slice name: `"userAuth"`)

```ts
State: {
  user: User | null;          // null = not logged in
  isConnected: boolean;       // WebSocket connection status
  unreadNotifCount: number;   // notification badge count
}
```

| Action | Description |
|--------|-------------|
| `setUser(user)` | Set or clear the authenticated user |
| `setConnected(boolean)` | Update WebSocket connection status |
| `incrementUnreadNotif()` | Add 1 to unread count |
| `resetUnreadNotif()` | Set unread count to 0 |
| `updateUserProfileImage(url)` | Update user's image_url |

### `chatSlice` (slice name: `"chat"`)

```ts
State: {
  chats: Chat[];                          // sorted by most recent message
  onlineUsers: Record<string, string[]>;  // chatId → array of online userIds
}
```

| Action | Description |
|--------|-------------|
| `setChats(chats[])` | Replace entire chat list |
| `addChat(chat)` | Prepend a chat (deduplicates by id) |
| `setOnlineUsers({ chatId, userIds })` | Set online users for a chat |
| `addOnlineUser({ chatId, userId })` | Add user to online list |
| `removeOnlineUser({ chatId, userId })` | Remove user from online list |

---

## TanStack Query Cache Keys

Defined in `src/lib/queryKeys.ts`:

```ts
chatKeys = {
  all: ['chats'],
  lists: () => [...chatKeys.all, 'list'],
  messages: (chatId) => [...chatKeys.all, 'messages', chatId],
};

anonChatKeys = {
  all: ['anonymousChats'],
  lists: () => [...anonChatKeys.all, 'list'],
  detail: (id) => [...anonChatKeys.all, 'detail', id],
  messages: (id) => [...anonChatKeys.all, 'messages', id],
};

notifKeys = {
  all: ['notifications'],
  lists: () => [...notifKeys.all, 'list'],
};
```

The WebSocket handlers in `WebSocketContext.tsx` update these caches in real-time when `message:new`, `message:delete`, or `chat:new` events arrive.

---

## Frontend Routes

| Route | Component | Protected? | Description |
|-------|-----------|------------|-------------|
| `/` | `LandingPage` | No | Marketing page — auto-redirects to /home if logged in |
| `/welcome` | `WelcomePage` | No | Welcome page |
| `/login` | `LoginForm` | No | Clerk-powered login (renders `<SignIn>` component) |
| `/signup` | `SignUpForm` | No | Clerk-powered signup (renders `<SignUp>` component) |
| `/verification` | `VerificationPage` | No | Email verification (legacy, kept for compatibility) |
| `/home` | `Home` | Yes | Chat list / home feed |
| `/communities` | `Communities` | Yes | Communities page |
| `/chat/:chatId` | `ChatView` | Yes | Standard chat view |
| `/anonymous/:id` | `AnonymousChat` | Yes | Anonymous chat room |
| `/profile` | `ProfileView` | Yes | User profile |
| `/notification` | `NotificationsPage` | Yes | Notification feed |
| `*` | `NotFoundPage` | No | 404 page |

Protected routes are wrapped in `<ProtectedRoute>` which shows a spinner while `AuthContext.loading` is true (Clerk is initializing), then renders the content if a user exists in Redux or redirects to `/login` if not.

---

## Security

| Layer | Implementation |
|-------|---------------|
| **HTTP Headers** | Helmet (CSP, HSTS, frameguard, noSniff, hidePoweredBy, referrerPolicy, etc.) |
| **CSRF** | `validateOrigin.ts` checks `x-forwarded-host` (production) or `Origin`/`Referer` (dev) on mutating requests |
| **Rate Limiting** | Redis-backed sorted set: 10 attempts/min per IP, 5-min block. Falls back to in-memory Map when Redis is unavailable. |
| **Authentication** | Clerk handles session management, token rotation, MFA, and social OAuth. Backend verifies JWTs via `lib/auth.ts` wrapper (abstracts `@clerk/backend`). |
| **Chat Membership** | `requireChatMembership()` checks `StandardChatMembers` before allowing message read/write |
| **Image Storage** | S3 bucket is private. All URLs are presigned (1-hour expiry). Never stored in client state. |
| **Origin Validation** | `x-forwarded-host` header checked against `CORS_ORIGIN` in production; standard `Origin`/`Referer` in dev |

---

## Important Quirks

1. **`.npmrc`** has `legacy-peer-deps=true` — needed because some packages have conflicting peer dependencies
2. **Backend runs via `tsx`** (not `ts-node` or compiled JS) — `backend/server.js` is ESM `.js` that imports `.ts` files at runtime
3. **`erasableSyntaxOnly`** in frontend TS config means no `enum` / `namespace` — use `as const` objects or union types
4. **`documentation/` directory** has authoritative design docs (WebSocket protocol, auth flow, anonymous chat, notification system, routing)
5. **Prisma models** have `@@schema("auth")` and `@@schema("public")` — cross-schema queries work via generated client
6. **RLS** is enabled on most models (requires additional migration setup)
7. **Never push/add/commit/pull code on or from GitHub without asking**
8. **Do NOT read any env files at all costs**
9. **Two WebSocket providers** exist in the tree — `main.tsx` wraps the app in one, `RootLayout` wraps protected pages in another. The inner one shadows the outer one.
10. **Clerk appearance overrides** — `LoginForm.tsx` and `SignUpForm.tsx` apply dark-theme appearance overrides to Clerk's `<SignIn>` and `<SignUp>` components via the `appearance` prop. These use transparent backgrounds and the project's indigo accent color (`#7C6EF7`).
11. **Clerk ID vs DB UUID** — Clerk user IDs (e.g., `user_3Gp...`) are NOT valid UUIDs. The database requires UUID format. A `clerk_id` mapping column has been added to `USERS` and the `authenticate` middleware maps Clerk IDs to DB UUIDs via this column.
12. **`clerkFetch` must be used for all API calls** — Never use raw `fetch()` for backend requests. Always import `clerkFetch` from `../lib/clerkFetch` which injects the Clerk JWT automatically.

---

## All Backend API Endpoints

### Auth Hub (`/api/auth`)

| Method | Full Path | Auth | Description |
|--------|-----------|------|-------------|
| POST | `/api/auth/setup-user` | `authenticate` (Clerk JWT) | Eager user creation — returns DB user for current Clerk session |
| POST | `/api/auth/UserVerificaitonRouter/verify` | No | Verify email with 6-digit code |
| POST | `/api/auth/UserVerificaitonRouter/resend-verification` | No | Resend verification code |
| GET | `/api/auth/WsTicketRouter/ws-ticket` | `authenticate` (Clerk JWT) | Generate one-time WS auth ticket |

### Chat Routes (`/api/chats`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chats` | `authenticate` | Create chat (DM or group) |
| GET | `/api/chats` | `authenticate` | List user's chats with last message |
| POST | `/api/chats/:chatId/image` | `authenticate` + multer | Upload image to chat |
| GET | `/api/chats/:chatId/messages` | `authenticate` | Paginated messages (20/page) |
| POST | `/api/chats/:chatId/:userId/appendMessage` | `authenticate` | Send text message (REST) |
| PATCH | `/api/chats/:chatId/messages/:messageId/:userId` | `authenticate` | Edit message |
| DELETE | `/api/chats/:chatId/messages/:messageId/:userId` | `authenticate` | Delete message |

### Anonymous Chat Routes (`/api/anonymousChats`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/anonymousChats` | `authenticate` | List rooms (latest 20, with lastMessage + timestamp) |
| GET | `/api/anonymousChats/:id` | `authenticate` | Get single room |
| POST | `/api/anonymousChats/:id/join` | `authenticate` | Join room |
| GET | `/api/anonymousChats/:id/messages` | `authenticate` | Paginated messages (`?before=` cursor) |
| POST | `/api/anonymousChats/:id/messages/:userId/:isAnonymous` | `authenticate` | Send message |
| PATCH | `/api/anonymousChats/:id/messages/:messageId` | `authenticate` | Edit message |
| DELETE | `/api/anonymousChats/:id/messages/:messageId` | `authenticate` | Delete message |
| POST | `/api/anonymousChats/:messageId/upvote` | `authenticate` | Upvote message |
| POST | `/api/anonymousChats/:messageId/downvote` | `authenticate` | Downvote message |

### User Routes (`/api/users`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users/search?q=...` | `authenticate` | Search users by name/email/tag |
| PATCH | `/api/users/profile-image` | `authenticate` + multer | Upload profile image |

### Friend Routes (`/api/friends`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/friends/send` | `authenticate` | Send friend request by userTag |
| PATCH | `/api/friends/accept` | `authenticate` | Accept friend request |
| PATCH | `/api/friends/:id/reject` | `authenticate` | Reject friend request |

### Notification Routes (`/api/notifications`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | `authenticate` | Fetch notifications (`?unread=true` optional) |
| PATCH | `/api/notifications/:id/read` | `authenticate` | Mark single notification read |
| PATCH | `/api/notifications/read-all` | `authenticate` | Mark all notifications read |

### Health Check

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Returns `{ status: "ok" }` |
