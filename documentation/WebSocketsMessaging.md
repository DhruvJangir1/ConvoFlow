# WebSockets Messaging

## Overview

ConvoFlow uses a dedicated WebSocket server (port 8080, path `/ws`) for real-time messaging, typing indicators, and online presence. The WebSocket layer is built with the `ws` library and a raw `http.createServer()` instance, separate from the Express HTTP server.

## Architecture

```
Client Browser                   Express Server (port 3000)          WS Server (port 8080)
     │                                  │                                  │
     │  GET /api/auth/WsTicketRouter/    │                                  │
     │  ──────────────────────────────►  │                                  │
     │  ◄─── { ticket } ──────────────  │                                  │
     │                                                                     │
     │  WS ws://localhost:8080/ws?ticket=xxx                                │
     │  ───────────────────────────────────────────────────────────────►  │
     │                                                                     │
     │  ── subscribe({ chatIds }) ──────►                              │
     │  ◄── subscribed ─────────────────                              │
     │  ◄── user:online ────────────────                              │
     │  ◄── chat:online-users ──────────                              │
     │                                                                     │
     │  ── message:send({ chatId, content }) ──►                      │
     │  ◄── message:ack ─────────────────                              │
     │  ◄── message:new (broadcast to room) ──►                       │
```

## Authentication

### Ticket-Based Auth

WebSocket connections are authenticated using one-time tickets instead of cookies or JWTs directly:

1. **Client fetches a ticket** via `GET /api/auth/WsTicketRouter/ws-ticket` (requires auth cookie)
2. **Server generates** a UUID ticket with a 60-second TTL, stored in an in-memory `Map` (`backend/src/services/wsTicketStore.ts`)
3. **Client connects** to `ws://localhost:8080/ws?ticket=<ticket>`
4. **Server consumes** the ticket: if valid and not expired, the connection is accepted; otherwise closed with code `4001`

### Ticket Store (`backend/src/services/wsTicketStore.ts`)

- In-memory `Map<string, { userId, expiresAt }>`
- Tickets auto-expire after 60 seconds
- Cleanup interval runs every 30 seconds to purge expired tickets
- One-time use: consumed immediately upon connection attempt

## Server Architecture (`backend/ws/websocket.ts`)

### Connection Lifecycle

1. **Connection received** — ticket authentication check
2. **User profile loaded** — `user_name` and `image_url` fetched from DB
3. **Socket stored** in `userSockets` Map (keyed by userId)
4. **Event listeners registered** — `pong`, `message`, `close`, `error`
5. **Heartbeat started** — 30-second ping/pong interval

### Data Structures

```typescript
interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  userName?: string;
  userImage?: string | null;
  isAlive?: boolean;
  subscribedRooms?: Set<string>;
}

const userSockets = new Map<string, AuthenticatedSocket>();
const chatRooms = new Map<string, Set<AuthenticatedSocket>>();
```

- `userSockets` — maps userId to their single active socket
- `chatRooms` — maps chatId to the set of connected sockets in that room

### Message Protocol

All messages are JSON with the format `{ type: string, payload: object }`.

#### Client → Server Messages

| Type | Payload | Description |
|------|---------|-------------|
| `subscribe` | `{ chatIds: string[] }` | Subscribe to one or more chat rooms |
| `unsubscribe` | `{ chatIds: string[] }` | Leave one or more chat rooms |
| `message:send` | `{ chatId, content, tempId? }` | Send a new message |
| `typing:start` | `{ chatId }` | User started typing |
| `typing:stop` | `{ chatId }` | User stopped typing |

#### Server → Client Messages

| Type | Payload | Description |
|------|---------|-------------|
| `subscribed` | `{ chatIds }` | Confirmation of subscription |
| `unsubscribed` | `{ chatIds }` | Confirmation of unsubscription |
| `message:new` | `{ id, chatId, senderId, senderName, senderImage, content, createdAt, isAnonymous? }` | New message broadcast |
| `message:ack` | `{ id, tempId? }` | Server confirmation of sent message |
| `typing:update` | `{ chatId, userId, isTyping }` | Typing status change |
| `user:online` | `{ chatId, userId }` | User came online in a chat |
| `user:offline` | `{ chatId, userId }` | User went offline in a chat |
| `chat:online-users` | `{ chatId, userIds }` | Full list of online users in a chat |
| `notification:new` | `Notification` | Real-time notification |
| `chat:new` | `{ chat }` | New chat created (e.g., after accepting friend request) |
| `error` | `{ message }` | Error message |

### Sending Messages Flow

1. Client sends `message:send` with `{ chatId, content, tempId? }`
2. Server validates authentication (`userId`, `userName`) and content
3. Message saved to `StandardChatMessages` table via Prisma
4. Chat's `updated_at` timestamp refreshed
5. `message:ack` sent back to the sender with the real message `id` (and `tempId` for optimistic UI matching)
6. `message:new` broadcast to all sockets in the chat room

### Room Management

- **`addToRoom(ws, chatId)`** — adds socket to a chat room; creates the room Set if it doesn't exist
- **`removeFromRoom(ws, chatId)`** — removes socket from a chat room
- **`removeSocketFromAllRooms(ws)`** — called on disconnect to clean up all room memberships
- On subscribe: broadcasts `user:online` to existing room members, sends `chat:online-users` to the subscriber
- On unsubscribe: broadcasts `user:offline` to remaining room members

### Typing Indicators

- `typing:start` / `typing:stop` messages are received from clients
- Broadcast as `typing:update` to the room with `{ chatId, userId, isTyping }`

### Heartbeat (Stale Connection Detection)

- 30-second interval pings all connected clients
- If a client doesn't respond with `pong` within one interval, it's terminated
- Prevents zombie connections from accumulating

### Graceful Shutdown

`shutdownWebSocket()`:
1. Stops ticket cleanup interval
2. Closes all active client connections with code `1001`
3. Closes the WebSocket server

## Client-Side (`src/context/WebSocketContext.tsx`)

### WebSocketProvider

The `WebSocketProvider` React context manages the connection lifecycle:

- **Connect**: Triggered when `user` becomes available. Fetches a ticket from `/api/auth/WsTicketRouter/ws-ticket`, then opens a WebSocket connection
- **Disconnect**: When `user` becomes null, the socket is cleaned up
- **Reconnect**: On unexpected close, attempts reconnection after a 2-second delay
- **Subscribe queue**: If subscriptions are requested before the socket opens, they are queued and re-sent once connected (with a 10-second timeout)

### Key Features

- `subscribeToChats(chatIds)` — subscribes to chat rooms, with queuing for not-yet-open connections
- `onMessage(handler)` — registers a message handler; returns an unsubscribe function
- `send(type, payload)` — sends a JSON message if the socket is open
- Redux integration: dispatches `setConnected`, `setOnlineUsers`, `addOnlineUser`, `removeOnlineUser`, `incrementUnreadNotif`, `addChat`
- **Auto-subscribe on `chat:new`**: When a `chat:new` message is received (e.g., after a friend request is accepted), the client automatically calls `subscribeToChats([newChatId])` — this also persists the chat ID into `subscribedChatsRef` so it survives reconnections, ensuring both users get real-time messages without manual subscription or page refresh

### Optimistic Updates

- Messages are rendered immediately with a `temp-` prefixed ID
- On `message:ack`, the temp ID is replaced with the server-assigned ID
- Fallback to REST API if WebSocket is disconnected (`POST /api/chats/:chatId/:userId/appendMessage`)

## Fallback Mechanism

When the WebSocket is disconnected, the `ChatView` component falls back to REST:

```typescript
if (isConnected) {
  send('message:send', { chatId, content: trimmed, tempId });
} else {
  fetch(`/api/chats/${chatId}/${user.id}/appendMessage`, { method: 'POST', ... });
}
```

## Key Files

| File | Role |
|------|------|
| `backend/ws/websocket.ts` | WebSocket server setup, connection handling, room management, message handling |
| `backend/src/services/wsTicketStore.ts` | In-memory ticket store with TTL and cleanup |
| `src/context/WebSocketContext.tsx` | Client-side WebSocket provider with reconnection, subscription queuing |
| `backend/src/routes/auth.ts` | Mounts WsTicketRouter |
| `backend/src/routes/wsTicket.ts` | Ticket generation endpoint |
