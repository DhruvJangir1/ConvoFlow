# ConvoFlow

Real-time messaging platform with end-to-end authentication, WebSocket-based instant messaging, friend system, and email verification.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Redux Toolkit, Tailwind CSS v4, React Router v7 |
| **Backend** | Node.js, Express 5, TypeScript (tsx runtime) |
| **Database** | PostgreSQL via Prisma ORM (with pg adapter) |
| **Auth** | Supabase Auth (admin API), bcrypt, JWT, httpOnly cookies |
| **Real-time** | ws (WebSocket server with room-based pub/sub) |
| **Email** | Resend (verification codes, notifications) |
| **Cache** | Redis (optional, for scaling) |
| **Monitoring** | Prometheus client metrics |

## Features

- **Auth** — Signup, login, logout, session refresh, email verification, password strength checker (HIBP integration)
- **Messaging** — Real-time 1-on-1 and group chats via WebSockets, message edit/delete, paginated history, typing indicators
- **Friends** — Send/accept/decline friend requests by user tag, friend list
- **Notifications** — Real-time notifications for friend requests via WebSocket
- **Profile** — Avatar with initials fallback, account details, stats (chats, messages)
- **Security** — Helmet (CSP, HSTS, frameguard), CSRF origin validation, rate limiting, httpOnly cookies

## Prerequisites

- **Node.js** >= 20
- **PostgreSQL** >= 14
- **npm** or **pnpm**

## Environment Variables

Copy `.env.example` to `.env` (root) and `backend/.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/convoflow?schema=public"

# Supabase (for auth)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Email (Resend)
RESEND_API_KEY=re_your-api-key

# Optional
REDIS_URL=redis://localhost:6379
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

## Getting Started

```bash
# 1. Install dependencies
npm install
cd backend && npm install && cd ..

# 2. Generate Prisma client
npx prisma generate

# 3. Apply migrations (run SQL files in prisma/migrations/ in order)
#    If you have existing users, first backfill their user tags:
node prisma/backfillUserTags.js
#    Then apply the migration SQL files manually via psql or your DB GUI.

# 4. (Optional) Seed the database
npm run seed

# 5. Start both frontend and backend
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:3000`.

## Project Structure

```
├── backend/
│   ├── server.js              # Express entrypoint
│   ├── src/
│   │   ├── routes/            # Auth, chat, friends, users, notifications
│   │   ├── services/          # Auth, email, rate limiter, verification store
│   │   ├── middleware/        # Authenticate, origin validation
│   │   ├── types/             # TypeScript interfaces
│   │   ├── util/              # Constants, helpers
│   │   ├── lib/               # DB pool, Prometheus metrics
│   │   ├── supabase/          # Supabase admin client
│   │   └── chat/              # Chat routes
│   ├── ws/                    # WebSocket server (room pub/sub)
│   └── dtos/                  # Response DTOs
├── src/                       # Frontend (React + Vite)
│   ├── auth/                  # Signup/Login forms
│   ├── components/            # Shared UI components
│   ├── context/               # Auth, Chat, WebSocket contexts
│   ├── layouts/               # App layout, navbar, chat list
│   ├── modals/                # Profile, search, friend request modals
│   ├── pages/                 # Chat view, notifications, welcome
│   ├── store/                 # Redux slices (user auth, chat)
│   └── types/                 # TypeScript interfaces
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Migration history
└── public/                    # Static assets
```

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/EmailVerificaitonRouter/signup` | Create account + send verification email |
| POST | `/api/auth/EmailVerificaitonRouter/login` | Authenticate, set httpOnly cookies |
| POST | `/api/auth/EmailVerificaitonRouter/logout` | Clear session |
| POST | `/api/auth/EmailVerificaitonRouter/check-password` | Validate password strength |
| GET | `/api/auth/TokenVerificaitonRouter/session` | Get current user from access token |
| POST | `/api/auth/TokenVerificaitonRouter/refresh` | Rotate tokens |
| POST | `/api/auth/UserVerificaitonRouter/verify` | Verify email with 6-digit code |
| POST | `/api/auth/UserVerificaitonRouter/resend-verification` | Resend verification code |

### Chats
| Method | Path | Description |
|---|---|---|
| GET | `/api/chats` | List user's chats (with last message & message count) |
| POST | `/api/chats` | Create DM or group chat |
| GET | `/api/chats/:chatId/messages` | Paginated messages (20 at a time) |
| POST | `/api/chats/:chatId/:userId/appendMessage` | Send message (REST fallback) |
| PATCH | `/api/chats/:chatId/messages/:messageId/:userId` | Edit message |
| DELETE | `/api/chats/:chatId/messages/:messageId/:userId` | Delete message |

### Friends
| Method | Path | Description |
|---|---|---|
| POST | `/api/friends/send` | Send friend request by user tag |
| GET | `/api/friends/pending` | List pending requests |
| PATCH | `/api/friends/:id/accept` | Accept request (auto-creates DM) |
| PATCH | `/api/friends/:id/decline` | Decline request |

### Users
| Method | Path | Description |
|---|---|---|
| GET | `/api/users/search?q=` | Search users by username/tag |

## Deployment

### One-command deploy

```bash
npm start
```

This builds the frontend (`dist/`) and starts the backend on `PORT` (default 3000). The backend serves the built frontend as static files.

### Required env vars in production

```env
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
DATABASE_URL=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
RESEND_API_KEY=...
```

### Hosting recommendations

- **Backend** — Render, Railway, Fly.io, or any Node.js host
- **Database** — Supabase PostgreSQL or any hosted Postgres
- **Frontend** — Can be served by the backend itself (built-in static serving) or separately via Vercel/Netlify
