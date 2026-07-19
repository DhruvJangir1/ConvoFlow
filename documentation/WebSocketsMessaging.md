# WebSockets Messaging

## Overview

ConvoFlow uses a dedicated WebSocket server (port 8080, path `/ws`) for real-time messaging, typing indicators, online presence, and message deletion. The WebSocket layer is built with the `ws` library and a raw `http.createServer()` instance, separate from the Express HTTP server.

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
     │                                                                     │
     │  ── (REST) DELETE /api/chats/:chatId/messages/:messageId ──►    │
     │  ◄── message:delete (broadcast to room) ──►                    │
```

## Authentication

### Ticket-Based Auth

WebSocket connections are authenticated using one-time tickets instead of cookies or JWTs directly:

1. **Client fetches a ticket** via `GET /api/auth/WsTicketRouter/ws-ticket` (requires auth cookie via `authenticate` middleware)
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
2. **Event listeners registered** — `pong`, `message`, `close`, `error`
3. **Socket stored** in `userSockets` Map (keyed by userId)
4. **User profile loaded** — `user_name` and `image_url` fetched from DB (async, happens after socket is already registered)
5. **Heartbeat started** — 30-second ping/pong interval

**Important**: Event listeners and `userSockets.set()` are registered **before** the async DB lookup. This ensures the socket is immediately available for other concurrent operations (e.g., `broadcastToRoom`, `sendToUser`) while the profile is still being fetched.

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
| `message:new` | `{ id, chatId, senderId, senderName, senderImage, content, createdAt, isAnonymous?, messageType? }` | New message broadcast |
| `message:ack` | `{ id, tempId? }` | Server confirmation of sent message |
| `message:delete` | `{ chatId, messageId, senderId, isAnonymous }` | Message deleted (broadcast to room) |
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

### Deleting Messages Flow

Message deletion happens via REST (not WebSocket), but the result is broadcast in real-time:

1. Client sends `DELETE /api/chats/:chatId/messages/:messageId/:userId` (standard) or `DELETE /api/anonymousChats/:id/messages/:messageId` (anonymous)
2. Server verifies membership, ownership, then deletes from DB
3. Server broadcasts `message:delete` to the room via `broadcastToRoom()`
4. All room members remove the message from their UI immediately

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
- **Subscribe queue**: If subscriptions are requested before the socket opens, they are queued in `subscribedChatsRef` and re-sent once connected. On reconnect, all queued subscriptions are re-sent automatically.

### Type-Safe Message Handling

All incoming message handlers are fully typed using a `HandlerMap` interface and dispatched via a `switch` statement:

```typescript
type HandlerMap = {
  'chat:online-users': Extract<WSMessage, { type: 'chat:online-users' }>['payload'];
  'user:online': Extract<WSMessage, { type: 'user:online' }>['payload'];
  'user:offline': Extract<WSMessage, { type: 'user:offline' }>['payload'];
  'notification:new': Extract<WSMessage, { type: 'notification:new' }>['payload'];
  'chat:new': Extract<WSMessage, { type: 'chat:new' }>['payload'];
  'message:new': MessageNewPayload;
  'message:delete': Extract<WSMessage, { type: 'message:delete' }>['payload'];
};
```

### Built-in Cache Handlers

The `WebSocketContext` has built-in handlers that automatically update TanStack Query caches and Redux state:

| Event | React Query Cache | Redux | Other |
|-------|------------------|-------|-------|
| `message:new` | Updates `chatKeys.messages(chatId)`, updates `chatKeys.lists()` + `anonChatKeys.lists()` (lastMessage/timestamp) | Dispatches `setChats()` for sidebar reorder | — |
| `message:delete` | Filters deleted message from `chatKeys.messages(chatId)` (standard chats only — anonymous chat messages are NOT updated in the cache by this handler) | — | — |
| `chat:new` | Prepends chat to `chatKeys.lists()` | Dispatches `addChat()` | Auto-subscribes to new room |
| `notification:new` | Prepends to `notifKeys.lists()` | Dispatches `incrementUnreadNotif()` | — |
| `user:online` | — | Dispatches `addOnlineUser()` | — |
| `user:offline` | — | Dispatches `removeOnlineUser()` | — |
| `chat:online-users` | — | Dispatches `setOnlineUsers()` | — |

### Custom Message Handlers

Components can register additional handlers via `onMessage(handler)` which returns an unsubscribe function. The `ChatView` and `AnonymousChat` components use this for:

- **`message:ack` / `message:new` race condition**: `ChatView` checks if a message with the real ID already exists before adding (deduplication)
- **`message:delete`**: `ChatView` filters the deleted message from its local `messages` state
- **`message:new` in anonymous chats**: `AnonymousChat` directly appends messages to its local state

> **Note**: `AnonymousChat` does NOT have a `message:delete` handler in its `onMessage` callback. Deleted anonymous messages are only removed from the React Query cache by the built-in `WebSocketContext` handler, but since `AnonymousChat` renders from local state (not the cache), deleted messages remain visible until the user navigates away and back.

### Key Features

- `subscribeToChats(chatIds)` — subscribes to chat rooms, with queuing for not-yet-open connections
- `onMessage(handler)` — registers a message handler; returns an unsubscribe function
- `send(type, payload)` — sends a JSON message if the socket is open
- Redux integration: dispatches `setConnected`, `setOnlineUsers`, `addOnlineUser`, `removeOnlineUser`, `incrementUnreadNotif`, `addChat`, `setChats`
- **Auto-subscribe on `chat:new`**: When a `chat:new` message is received (e.g., after a friend request is accepted), the client automatically calls `subscribeToChats([newChatId])` — this also persists the chat ID into `subscribedChatsRef` so it survives reconnections

### Optimistic Updates

- Messages are rendered immediately with a `temp-` prefixed ID
- On `message:ack`, the temp ID is replaced with the server-assigned ID
- Fallback to REST API if WebSocket is disconnected (`POST /api/chats/:chatId/:userId/appendMessage`)

## Fallback Mechanism

When the WebSocket is disconnected, the `ChatInput` component falls back to REST:

```typescript
if (isConnected) {
  send('message:send', { chatId, content: trimmed, tempId });
} else {
  fetch(`/api/chats/${chatId}/${user.id}/appendMessage`, { method: 'POST', ... });
}
```

## Auto-Subscribe on Page Load

Both regular and anonymous chat rooms are auto-subscribed on page load:

- **Regular chats**: `ChatContext.tsx` fetches the chat list and calls `subscribeToChats()` for all chat IDs
- **Anonymous chats**: `ChatList.tsx` fetches anonymous rooms and calls `subscribeToChats()` for all room IDs

This ensures real-time message delivery for all rooms without requiring manual subscription.

## Key Files

| File | Role |
|------|------|
| `backend/ws/websocket.ts` | WebSocket server setup, connection handling, room management, message handling |
| `backend/src/services/wsTicketStore.ts` | In-memory ticket store with TTL and cleanup |
| `src/context/WebSocketContext.tsx` | Client-side WebSocket provider with reconnection, subscription queuing, type-safe handlers |
| `src/context/ChatContext.tsx` | Auto-subscribes to all regular chat rooms on load |
| `src/layouts/ChatList.tsx` | Auto-subscribes to all anonymous chat rooms on load |
| `src/types/WsMessageNotification.ts` | `WSMessage` discriminated union type for all message types |
| `backend/src/routes/auth.ts` | Mounts WsTicketRouter |
| `backend/src/routes/wsTicket.ts` | Ticket generation endpoint |
| `backend/src/chat/chat.ts` | REST message deletion broadcasts `message:delete` to room |
| `backend/src/routes/anonymousChat.ts` | REST anonymous message deletion broadcasts `message:delete` to room |
