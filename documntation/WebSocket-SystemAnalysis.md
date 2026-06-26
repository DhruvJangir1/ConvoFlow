# WebSocket System Analysis

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                        Browser                           │
│  ┌───────────────────┐     ┌──────────────────────────┐  │
│  │  WebSocketContext │     │   REST (fetch API)       │  │
│  │  - connect        │     │   - login/signup         │  │
│  │  - subscribe      │     │   - search users         │  │
│  │  - send/receive   │     │   - create chat          │  │
│  │  - auto-reconnect │     │   - fetch messages       │  │
│  └────────┬──────────┘     └──────────┬───────────────┘  │
└───────────┼───────────────────────────┼──────────────────┘
            │                           │
            │ ws://:8080/ws?ticket=X    │ http://:3000/api/*
            │                           │
┌───────────▼───────────────────────────▼──────────────────┐
│                    Server (Node.js)                      │
│                                                          │
│  ┌─────────────────────┐    ┌─────────────────────────┐  │
│  │  WebSocket Server   │    │   Express REST API      │  │
│  │  (native ws, :8080) │    │   (express, :3000)      │  │
│  │                     │    │                         │  │
│  │  wsTicketStore ─────┼────┼──► authenticate         │  │
│  │                     │    │                         │  │
│  └──────────┬──────────┘    └──────────┬──────────────┘  │
│             │                          │                 │
│             └──────────┬───────────────┘                 │
│                        ▼                                 │
│              ┌──────────────────┐                        │
│              │   PostgreSQL DB  │                        │
│              │   (Prisma ORM)   │                        │
│              └──────────────────┘                        │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Connection Lifecycle

### 2a. Ticket-Based Authentication

Instead of sending raw JWTs over WebSocket (which can't be set as httpOnly cookies), ConvoFlow uses **one-time tickets**:

```
Client                              Server
  │                                    │
  │  1. POST /api/auth/login           │
  │  ───────────────────────────────►  │  Sets httpOnly cookies
  │  ◄───────────────────────────────  │  (access_token, refresh_token)
  │                                    │
  │  2. GET /api/auth/.../ws-ticket    │
  │  (cookies sent automatically)      │
  │  ───────────────────────────────►  │  verifyAccessToken(cookie)
  │                                    │  ticket = crypto.randomUUID()
  │                                    │  tickets.set(ticket, { userId, expiresAt })
  │  ◄───────────────────────────────  │  { ticket: "uuid-..." }
  │                                    │
  │  3. new WebSocket("ws://:8080/ws   │
  │       ?ticket=uuid-...")           │
  │  ───────────────────────────────►  │  consumeTicket(ticket)
  │                                    │  → returns userId (or null → close 4001)
  │                                    │  ws.userId = userId
  │  ◄─────── (connection open) ────── │
```

**Why tickets?** The `ws` library doesn't support custom headers during the handshake. Cookies on the WebSocket upgrade request are browser-dependent. Tickets solve this: one-time use, 60s TTL, stored in-memory Map.

### 2b. Connection State

```typescript
// Server-side per-connection state (on the socket object itself)
interface AuthenticatedSocket extends WebSocket {
  userId?: string;           // Set during auth
  isAlive?: boolean;         // Heartbeat flag
  subscribedRooms?: Set<string>;  // ChatIds this socket is listening to
}

// Server-side global maps
const userSockets = new Map<string, AuthenticatedSocket>();  // userId → socket
const chatRooms   = new Map<string, Set<AuthenticatedSocket>>(); // chatId → Set<socket>
```

---

## 3. JSON Protocol

### Client → Server

| type | payload | Purpose |
|------|---------|---------|
| `subscribe` | `{ chatIds: string[] }` | Join one or more chat rooms |
| `unsubscribe` | `{ chatIds: string[] }` | Leave chat rooms |
| `message:send` | `{ chatId, content, tempId? }` | Send a message |
| `typing:start` | `{ chatId }` | User started typing |
| `typing:stop` | `{ chatId }` | User stopped typing |

### Server → Client

| type | payload | Purpose |
|------|---------|---------|
| `subscribed` | `{ chatIds }` | Confirms subscription |
| `unsubscribed` | `{ chatIds }` | Confirms unsubscription |
| `message:new` | `{ id, chatId, senderId, content, createdAt }` | New message broadcast |
| `message:ack` | `{ id, tempId? }` | Confirms save, echoes tempId for optimistic UI |
| `typing:update` | `{ chatId, userId, isTyping }` | Typing indicator |
| `user:online` | `{ chatId, userId }` | User came online in a chat |
| `user:offline` | `{ chatId, userId }` | User went offline |
| `chat:online-users` | `{ chatId, userIds }` | Full online list on subscribe |
| `error` | `{ message }` | Error message |

---

## 4. Room Management (Dual-Map Pattern)

```
subscribe("chat-abc"):
  ┌──────────┐     add      ┌───────────────────────────┐
  │  socket  │ ──────────►  │ chatRooms["chat-abc"]     │
  │          │              │ Set<AuthenticatedSocket>  |
  │  userId: │              └───────────────────────────┘
  │  "user-1"│                  ▲
  │          │     add          │
  │  rooms:  │  ────────────────┘
  │  {"chat- │
  │   abc"}  │
  └──────────┘
```

**broadcastToRoom(chatId, data, exclude):**
```
chatRooms.get(chatId) → Set<socket>
  → serialize JSON once
  → for each socket (except exclude):
      if socket.readyState === OPEN → socket.send(json)
```

**On disconnect:**
```
1. Iterate socket.subscribedRooms
2. For each room:
   a. chatRooms[room].delete(socket)  → remove from room
   b. broadcast user:offline to remaining members
3. userSockets.delete(socket.userId)
```

---

## 5. Message Flow

### Sending a Message (sender's perspective)

```
  User types "hello"
       │
       ▼
  ChatView.sendMessage()
       │
       ├── 1. Add optimistic message (tempId) to local state
       │      { id: "temp-1719000000", content: "hello", ... }
       │
       ├── 2. WebSocket.send("message:send", { chatId, content, tempId })
       │
       ▼
  WebSocket Server
       │
       ├── 3. prisma.messages.create(...) → persist to DB
       ├── 4. prisma.chats.update({ updated_at: new Date() })
       │
       ├── 5. WebSocket.send("message:ack", { id: "real-uuid", tempId })
       │      └── Client replaces tempId with real ID in local state
       │
       └── 6. broadcastToRoom(chatId, "message:new", { id, senderId, content, createdAt })
              └── All OTHER subscribers receive the message in real-time
```

### Receiving a Message (receiver's perspective)

```
ChatView chatId subscription (useEffect):
  1. subscribeToChats([chatId])     → join WebSocket room
  2. GET /api/chats/:chatId/messages → load history via REST
  3. onMessage handler:
       if msg.type === "message:new" && msg.payload.chatId === current chatId:
         append msg.payload to messages state (dedup by id)

  Result: previous messages from REST + new messages appear instantly via WebSocket
```

---

## 6. Heartbeat & Cleanup

### Heartbeat (30s interval)

```
Server → ping → Client
Client → pong → Server (sets isAlive = true)

If no pong within 30s:
  → ws.terminate() (force close)
  → handleClose() called automatically
```

### Cleanup on Disconnect

```typescript
function handleClose(ws):
  // 1. Get all rooms this socket was in
  const rooms = [...ws.subscribedRooms]

  // 2. Remove socket from every room
  removeSocketFromAllRooms(ws)

  // 3. Broadcast offline to each room
  for (const chatId of rooms):
    broadcastToRoom(chatId, { type: "user:offline", payload: { chatId, userId } })

  // 4. Remove from global user map
  userSockets.delete(ws.userId)
```

### Frontend Reconnection

```typescript
ws.onclose = () => {
  setOnlineUsers(new Map())           // Clear presence state
  if (user) {
    // Auto-reconnect after 2s
    reconnectTimer = setTimeout(connect, 2000)
  }
}
```

---

## 7. Presence System

```
User A subscribes to "chat-abc":
  ┌─► server sends "subscribed" to A
  ├─► server broadcasts "user:online" { userId: A, chatId: "chat-abc" }
  │   to ALL OTHER subscribers of "chat-abc"
  └─► server sends "chat:online-users" { userIds: [A, B, C] } to A only
       (full list so A knows who else is online)

User A disconnects:
  └─► server broadcasts "user:offline" { userId: A, chatId: "chat-abc" }
       to remaining subscribers

Frontend:
  ChatHeader reads onlineUsers.get(chatId) → shows green/gray dot
  WebSocketContext maintains onlineUsers: Map<string, string[]>
  Updated on: chat:online-users (full replace), user:online (append), user:offline (remove)
```

---

## 8. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **WebSocket for real-time, REST for history** | REST provides reliable CRUD with HTTP semantics; WebSocket provides low-latency fan-out. Neither replaces the other. |
| **Dual maps instead of single map** | `chatRooms` gives O(1) broadcasts; `socket.subscribedRooms` gives O(1) disconnect cleanup. Without both, one direction requires iteration. |
| **TempId in protocol** | Without it, the client can't safely match `message:ack` to optimistic messages. Sending `tempId` round-trip is the standard solution. |
| **Separation of ports** | REST on `:3000`, WebSocket on `:8080`. Avoids coupling; either can be scaled independently. The `ws` library also needs its own HTTP server. |
| **Ticket auth (not raw JWT over WS)** | The native `ws` library's upgrade path doesn't allow custom headers. Cookies during upgrade are unreliable in browsers. Tickets are a one-time-use bridge. |
| **Disconnect broadcasts `user:offline`** | Without this, the user list becomes permanently stale. Cleanup is just as important as join. |
