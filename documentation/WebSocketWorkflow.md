# WebSocket Workflow

## Relevant Files

| File | Role |
|------|------|
| `backend/server.js` | Creates HTTP server, calls `createWebSocketServer(server)` to attach WS |
| `backend/ws/websocket.ts` | WebSocket server, room management, message routing |
| `backend/src/routes/wsTicket.ts` | `GET /api/auth/WsTicketRouter/ws-ticket` — generates one-time auth ticket |
| `backend/src/services/wsTicketStore.ts` | In-memory ticket store with 60s TTL |
| `backend/src/util/constants.ts` | `WS_TICKET_TTL_MS` constant |
| `backend/src/chat/chat.ts` | REST `appendMessage` route — writes to DB first, then broadcasts via WS |
| `src/main.tsx` | Mounts `WebSocketProvider` in the provider tree |
| `src/context/WebSocketContext.tsx` | Frontend — fetches ticket, opens WS, delegates cache mutations to wsCacheHandlers |
| `src/hooks/wsCacheHandlers.ts` | Plain functions that update TanStack Query cache for WS events |
| `src/pages/ChatView.tsx` | Chat view — receives real-time messages via WS |

---

## Connection Flow

```
1. Frontend calls GET /api/auth/WsTicketRouter/ws-ticket (via clerkFetch, sends Clerk JWT)
2. authenticate middleware verifies JWT → req.user.id is set
3. Server: generateTicket(userId) → stores userId in in-memory Map with 60s TTL
4. Server returns: { ticket: "<uuid>" }
5. Frontend opens: wss://host/ws?ticket=<ticket>
6. WebSocket server: consumeTicket(ticket) → get userId
   a. If invalid/expired → close with code 4001
   b. If valid → set ws.userId, register in userSockets Map
7. Server: ws.on('close') → userSockets.delete(userId) + remove from all rooms
```

---

## Real-Time Messaging Flow

### How messages get from User A to User B in real-time

```
1. User A types a message → ChatInput calls ws.send("message:send", { chatId, content })
2. Frontend sends WebSocket message: { type: "message:send", payload: { chatId, content } }
3. Server: validates userId, userName, content
4. Server: prisma.standardChatMessages.create({ chat_id, sender_id, content }) — writes to DB first
5. Server: prisma.standardChats.update({ updated_at: now }) — updates chat timestamp
6. Server sends ACK to sender: { type: "message:ack", payload: { id, tempId } }
7. Server broadcasts to room: { type: "message:new", payload: { id, chatId, senderId,
   senderName, senderImage, content, createdAt, isAnonymous, messageType } }
8. User B's WebSocket receives the message
9. WebSocketContext delegates to wsCacheHandlers.ts → addMessageToChatCache() updates TanStack Query cache
10. ChatView re-renders with the new message from the cache
```

### Duplicate prevention

- The sender's socket is excluded from the broadcast entirely — `broadcastToRoom` receives the sender's socket as `excludeSocket` and skips it
- The sender sees their own message from the `message:ack` ACK (tempId → real ID swap)
- Other users see the message instantly from the WS broadcast
- Cache dedup: `addMessageToChatCache` checks `old.messages.some(m => m.id === entry.id)` before adding

### Room subscription

- On connect, `WebSocketContext.tsx` fetches all chat IDs from `GET /api/chats/subscribed-ids` (standard memberships **+ latest 20 anonymous rooms**) and sends a single `subscribe` message for all of them
- `ChatContext.tsx` no longer handles subscription — it's centralized in WebSocketContext
- The server validates **standard** chat IDs against `StandardChatMembers` (membership enforced) but validates **anonymous** room IDs against `AnonymousChats` (existence only — anon rooms are effectively public)
- Per-chat lazy subscribe: `ChatView.tsx` / `AnonymousChat.tsx` call `subscribeToChats([chatId])` on mount, so a chat opened directly is subscribed even if it wasn't in the initial batch
- This means every connected user is listening to every standard chat they belong to and every anonymous room

---

## In-Memory Stores

### `userSockets: Map<string, WebSocket>`
Maps `userId → socket`. Used for:
- `sendMessageToUser()` — direct message to a specific user
- `subscribeToRoom()` / `unsubscribeFromRoom()` — look up a user's socket to add/remove from rooms

### `chatRooms: Map<string, Set<WebSocket>>`
Maps `chatId → Set of sockets`. Used for:
- `broadcastToRoom()` — send a message to everyone in a chat
- `broadcastMessageToRoom()` — send raw buffer to everyone in a chat
- `subscribeToRoom()` — add a user's socket to a chat's Set
- `unsubscribeFromRoom()` — remove a user's socket from a chat's Set

---

## Message Protocol

All messages are JSON. The `type` field determines the action.

### Client → Server

| Type | Payload | Description |
|------|---------|-------------|
| `subscribe` | `{ chatIds: string[] }` | Subscribe to one or more chat rooms |
| `unsubscribe` | `{ chatIds: string[] }` | Unsubscribe from one or more chat rooms |
| `message:send` | `{ chatId: string, content: string }` | Send a message to a chat |
| `typing:start` | `{ chatId: string }` | Start typing indicator |
| `typing:stop` | `{ chatId: string }` | Stop typing indicator |

### Server → Client

| Type | Payload | Description |
|------|---------|-------------|
| `message:new` | `{ id, chatId, senderId, senderName, senderImage, content, createdAt, isAnonymous, messageType }` | New message broadcast to all room members |
| `message:ack` | `{ id, tempId? }` | Acknowledgement sent to message sender with real DB ID |
| `message:delete` | `{ chatId, messageId, senderId, isAnonymous }` | Message deleted broadcast |
| `chat:online-users` | `{ chatId, userIds }` | List of online users in a chat |
| `user:online` | `{ chatId, userId }` | User came online in a chat |
| `user:offline` | `{ chatId, userId }` | User went offline in a chat |
| `notification:new` | `{ id, type, content, ... }` | New notification for a user |
| `chat:new` | `{ chat: {...} }` | New chat created |
| `typing:update` | `{ chatId, userId, isTyping }` | Typing indicator update |
| `subscribed` | `{ chatIds: string[] }` | Acknowledgement of subscribe |
| `unsubscribed` | `{ chatIds: string[] }` | Acknowledgement of unsubscribe |

---

## Frontend WebSocket Context

### What `WebSocketContext.tsx` does
1. Fetches a ticket from `/api/auth/WsTicketRouter/ws-ticket` via `clerkFetch`
2. Opens a WebSocket connection with the ticket
3. On `open`: fetches all chat IDs (standard memberships + anonymous rooms) via `GET /api/chats/subscribed-ids`, subscribes to all rooms
4. On `message`: parses JSON, delegates to typed handlers that call `wsCacheHandlers.ts` functions
5. On `close`: auto-reconnects after 2 seconds
6. Exposes `socket`, `send(type, payload)`, `subscribeToChats(chatIds)`, `onMessage(handler)` via React Context

### How messages update the UI
- `ws.onmessage` receives `{ type: "message:new", payload: {...} }`
- Handler calls `addMessageToChatCache(queryClient, dispatch, payload, userId)` from `wsCacheHandlers.ts`
- This appends the message to `chatKeys.messages(chatId)` cache and updates `chatKeys.lists()` lastMessage
- `ChatView`'s `useEffect` on `messagesData` picks up the cache change and re-renders

### Duplicate prevention
- Sender's socket is excluded server-side from the broadcast — they never receive their own message via WS
- As a safety net, `addMessageToChatCache` checks for existing message IDs in cache before adding

---

## Server-Side Functions

| Function | Purpose |
|----------|---------|
| `createWebSocketServer(server)` | Attaches WS server to HTTP server at `/ws`, handles auth + message routing |
| `sendMessageToUser(ws, data)` | Sends JSON data to a single user's socket |
| `broadcastToRoom(chatId, data)` | Sends JSON data to every open socket in a room |
| `broadcastMessageToRoom(chatId, data, isBinary)` | Sends raw buffer to every open socket in a room |
| `subscribeToRoom(chatId, userId)` | Adds a user's socket to a room's Set |
| `unsubscribeFromRoom(chatId, userId)` | Removes a user's socket from a room's Set |
| `removeSocketFromAllRooms(ws)` | Removes a socket from all rooms (used on disconnect) |
| `handleSendMessage(ws, payload)` | Handles `message:send` — writes to DB, broadcasts, sends ACK |

---

## Ticket Auth Details

- `wsTicketStore.ts` uses an in-memory `Map<ticket, { userId, expiresAt }>`
- Tickets expire after 60 seconds (`WS_TICKET_TTL_MS`)
- `consumeTicket()` is one-time use — deletes the ticket after reading
- Expired entries are evicted by a `setInterval` running every 60s
- The WS server rejects connections without a valid ticket with close code `4001`

---

## Cleanup on Disconnect

When a client disconnects (`ws.on('close')`):
1. `userSockets.delete(userId)` — remove from the user→socket map
2. `removeSocketFromAllRooms(ws)` — loop through all rooms and remove the socket from every Set
