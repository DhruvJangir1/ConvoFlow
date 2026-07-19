# ConvoFlow

Real-time messaging platform with end-to-end authentication, WebSocket-based instant messaging, anonymous chats, friend system, and email verification.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Redux Toolkit, Tailwind CSS v4, React Router v7, TanStack React Query |
| **Backend** | Node.js, Express 5, TypeScript (tsx runtime) |
| **Database** | PostgreSQL via Prisma ORM (with pg adapter) |
| **Auth** | Supabase Auth (admin API), bcrypt, JWT, httpOnly cookies |
| **Real-time** | ws (WebSocket server with room-based pub/sub) |
| **Email** | Resend (verification codes, friend request notifications) |
| **Cache** | Redis via Upstash (rate limiting, refresh token replay detection) |
| **Storage** | Supabase S3 (image uploads — profile pictures, chat images) |

## Features

- **Auth** — Signup, login, logout, session refresh, email verification, password strength checker (HIBP integration)
- **Messaging** — Real-time 1-on-1 and group chats via WebSockets, message edit/delete with real-time broadcast, paginated history, typing indicators
- **Anonymous Chats** — Anonymous messaging rooms with identity toggle, upvote/downvote system, real-time updates
- **Friends** — Send/accept/decline friend requests by user tag, friend list
- **Notifications** — Real-time notifications for friend requests via WebSocket, unread badge
- **Profile** — Avatar with initials fallback, account details, stats (chats, messages)
- **Image Sharing** — Paste images in chat, upload profile pictures (stored in S3, served via presigned URLs)
- **Security** — Helmet (CSP, HSTS, frameguard), CSRF origin validation, rate limiting (Redis + in-memory fallback), httpOnly cookies, refresh token rotation with race condition prevention, HTML sanitization, chat membership authorization

## Prerequisites

- **Node.js** >= 20
- **PostgreSQL** >= 14
- **npm** (v9+)
- **Redis** (optional — rate limiter falls back to in-memory if unavailable)

## Environment Variables

### Frontend (root `.env`)

```env
VITE_WS_URL=wss://your-backend-domain.com/ws   # WebSocket server URL
```

### Backend (`backend/.env`)

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/convoflow?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/convoflow?schema=public"

# Supabase (for auth)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Email (Resend)
RESEND_API_KEY=re_your-api-key

# S3 (image storage)
SUPABASE_S3_BUCKET_ENDPOINT=your-s3-endpoint
SUPABASE_S3_ACCESS_KEY_ID=your-access-key
SUPABASE_S3_SECRET_ACCESS_KEY=your-secret-key
SUPABASE_S3_BUCKET_NAME=your-bucket-name

# Optional
UPSTASH_REDIS_REST_URL=redis://localhost:6379
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

## Getting Started

```bash
# 1. Install dependencies (root + backend via postinstall)
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Apply migrations (run SQL files in prisma/migrations/ in order)
#    If you have existing users, first backfill their user tags:
node prisma/backfillUserTags.js
#    Then apply the migration SQL files manually via psql or your DB GUI.

# 4. Start both frontend and backend
# Terminal 1 — Backend (tsx watch, auto-restarts, port 3000)
cd backend && npm run dev

# Terminal 2 — Frontend (Vite, port 5173)
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:3000`. The Vite dev server proxies `/api/*` requests to the backend automatically.

## Project Structure

```
├── backend/
│   ├── server.js              # Express entrypoint (ESM, imports .ts via tsx)
│   ├── src/
│   │   ├── routes/            # Auth, chat, friends, users, notifications, anonymous chats
│   │   ├── services/          # Auth, email, rate limiter, image upload, vote logic
│   │   ├── middleware/        # Authenticate (JWT + locked refresh rotation), origin validation
│   │   ├── chat/              # Standard chat routes + image signing helpers
│   │   ├── types/             # TypeScript interfaces
│   │   ├── util/              # Constants (cookie options, Prisma select)
│   │   ├── lib/               # DB pool, Prometheus metrics
│   │   ├── supabase/          # Supabase admin client + S3 client
│   │   └── config/            # Supabase config
│   ├── ws/                    # WebSocket server (room pub/sub, ticket auth)
│   ├── redis/                 # Upstash Redis client
│   └── dtos/                  # Response DTOs
├── src/                       # Frontend (React + Vite)
│   ├── auth/                  # Signup/Login forms + password validator
│   ├── components/            # Shared UI components (ChatInput, MessageList, etc.)
│   ├── context/               # Auth, Chat, WebSocket contexts
│   ├── hooks/                 # TanStack Query hooks (chats, messages, notifications, anonymous)
│   ├── layouts/               # App layout, sidebar, chat list, navbar
│   ├── modals/                # Profile, search, friend request, image modals
│   ├── pages/                 # Chat view, notifications, anonymous chats, profile
│   ├── store/                 # Redux slices (user auth, chat list)
│   ├── lib/                   # Query keys, date formatting, Supabase client
│   └── types/                 # TypeScript interfaces
├── prisma/
│   ├── schema.prisma          # Database schema (auth + public schemas)
│   └── migrations/            # Migration history
├── documentation/             # Design docs (WebSocket protocol, auth flow, etc.)
└── public/                    # Static assets
```

## API Endpoints

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/EmailVerificaitonRouter/signup` | Create account + send verification email |
| POST | `/api/auth/EmailVerificaitonRouter/login` | Authenticate, set httpOnly cookies |
| POST | `/api/auth/EmailVerificaitonRouter/logout` | Clear session + invalidate refresh token |
| POST | `/api/auth/EmailVerificaitonRouter/check-password` | Validate password strength + HIBP check |
| GET | `/api/auth/TokenVerificationRouter/session` | Hydrate auth state + rotate tokens if needed |
| POST | `/api/auth/TokenVerificationRouter/refresh` | Explicit token refresh |
| POST | `/api/auth/UserVerificaitonRouter/verify` | Verify email with 6-digit code |
| POST | `/api/auth/UserVerificaitonRouter/resend-verification` | Resend verification code |
| GET | `/api/auth/WsTicketRouter/ws-ticket` | Generate one-time WebSocket auth ticket |

### Chats

| Method | Path | Description |
|---|---|---|
| GET | `/api/chats` | List user's chats (with last message & message count) |
| POST | `/api/chats` | Create DM or group chat |
| GET | `/api/chats/:chatId/messages` | Paginated messages (20 at a time, `?before=` cursor) |
| POST | `/api/chats/:chatId/image` | Upload image to chat (multipart, 5MB limit) |
| POST | `/api/chats/:chatId/:userId/appendMessage` | Send message (REST fallback) |
| PATCH | `/api/chats/:chatId/messages/:messageId/:userId` | Edit message |
| DELETE | `/api/chats/:chatId/messages/:messageId/:userId` | Delete message (broadcasts `message:delete`) |

### Anonymous Chats

| Method | Path | Description |
|---|---|---|
| GET | `/api/anonymousChats` | List rooms (latest 20, with lastMessage + timestamp) |
| GET | `/api/anonymousChats/:id` | Get single room details |
| POST | `/api/anonymousChats/:id/join` | Join a room |
| GET | `/api/anonymousChats/:id/messages` | Paginated messages (`?before=` cursor) |
| POST | `/api/anonymousChats/:id/messages/:userId/:isAnonymous` | Send message (anonymous or identified) |
| PATCH | `/api/anonymousChats/:id/messages/:messageId` | Edit message |
| DELETE | `/api/anonymousChats/:id/messages/:messageId` | Delete message (broadcasts `message:delete`) |
| POST | `/api/anonymousChats/:messageId/upvote` | Upvote message |
| POST | `/api/anonymousChats/:messageId/downvote` | Downvote message |

### Friends

| Method | Path | Description |
|---|---|---|
| POST | `/api/friends/send` | Send friend request by user tag |
| PATCH | `/api/friends/accept` | Accept request (auto-creates DM + broadcasts `chat:new`) |
| PATCH | `/api/friends/:id/reject` | Reject request |

### Users

| Method | Path | Description |
|---|---|---|
| GET | `/api/users/search?q=` | Search users by username/email/tag |
| PATCH | `/api/users/profile-image` | Upload profile image (multipart) |

### Notifications

| Method | Path | Description |
|---|---|---|
| GET | `/api/notifications` | Fetch notifications (`?unread=true` optional) |
| PATCH | `/api/notifications/:id/read` | Mark single notification read |
| PATCH | `/api/notifications/read-all` | Mark all notifications read |

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Returns `{ status: "ok" }` |

## Deployment

### Current Deployment

- **Frontend**: Vercel at `https://convo-flow-4eu6.vercel.app`
- **Backend**: Render at `https://convoflow-2.onrender.com`
- **WebSocket**: Same Render server on port 8080, path `/ws`
- **Vercel rewrites**: `/api/:path*` → Render backend (forwards path correctly)
- **CORS_ORIGIN** on Render: `https://convo-flow-4eu6.vercel.app`
- **VITE_WS_URL** on Vercel: `wss://convoflow-2.onrender.com/ws`

### Production Build

```bash
npm run build    # prisma generate → tsc -b → vite build
npm start        # build + start backend serving dist/
```

### Required Production Environment Variables

```env
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com          # MUST be a real URL, no wildcards
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
SUPABASE_JWT_SECRET=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
SUPABASE_S3_BUCKET_ENDPOINT=...
SUPABASE_S3_ACCESS_KEY_ID=...
SUPABASE_S3_SECRET_ACCESS_KEY=...
SUPABASE_S3_BUCKET_NAME=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

## Testing

```bash
# Backend (primary test runner)
cd backend && npx vitest run

# Frontend (disabled — testMatch: [])
npm run test-jest
```

## Lint & Typecheck

```bash
npm run lint      # ESLint
npx tsc -b        # TypeScript project references build
```

## Documentation

Detailed design docs are in the `documentation/` directory:

- [WebSocket Protocol](documentation/WebSocketsMessaging.md)
- [Auth System](documentation/UserAuth.md)
- [Anonymous Chat](documentation/AnonymouChattingFunctionality.md)
- [Notification System](documentation/NotificationSystem.md)
- [Image Upload](documentation/ImageUpload.md)
- [Architecture](documentation/ROUTING-ARCHITECTURE.md)
