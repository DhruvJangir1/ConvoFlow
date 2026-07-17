# Notification System

## Overview

ConvoFlow's notification system delivers real-time alerts for social interactions (friend requests, acceptances, declines). Notifications are persisted in the database and delivered in real-time via WebSockets.

## Architecture

```
Friend Request Flow
====================
Sender                          Server                        Receiver
  │                               │                              │
  │ POST /api/friends/send        │                              │
  │ ─────────────────────────►    │                              │
  │                               │── Create Notifications ──────│
  │                               │── Create AddFriendRequests ──│
  │                               │── WS notification:new ───────►
  │                               │── Send email ────────────────│
  │ ◄──── 201 ──────────────────  │                              │
  │                                                              │
                                                              ┌──│── User sees notification
                                                              │  │── Accept/Decline
                                                              │  │
Accept Flow                                                     │
  │                               │                              │
  │                               │◄── PATCH /api/friends/accept │
  │                               │── Create DM chat             │
  │                               │── Update notification type   │
  │ ◄── WS notification:new ─────│                              │
  │ ◄── WS chat:new ─────────────│                              │
  │                               │── WS chat:new ──────────────►│
```

## Database Model

### Notifications Table (`prisma/schema.prisma`)

```prisma
model Notifications {
  id               String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  created_at       DateTime           @default(now()) @db.Timestamptz(6)
  receiver_user_id String             @db.Uuid
  sender_user_id   String             @db.Uuid
  type             String             @default("")
  content          String?
  read_at          DateTime?          @db.Timestamptz(6)
  entity_id        String             @unique @db.Uuid
  AddFriendRequests AddFriendRequests?
}

model AddFriendRequests {
  id                String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sender_id         String        @db.Uuid
  receiver_id       String        @db.Uuid
  created_at        DateTime      @default(now()) @db.Timestamptz(6)
  status            String        @default("pending")
  updated_at        DateTime?     @db.Timestamptz(6)
  Notifications     Notifications @relation(fields: [id], references: [entity_id])
}
```

### Notification Types

| Type | Description |
|------|-------------|
| `friend_request` | A user sent a friend request |
| `friend_request_accepted` | A friend request was accepted (replaces original notification) |
| `friend_request_declined` | A friend request was declined |

## Backend

### Creating Notifications (`backend/src/services/userNotify.ts`)

Two exported functions:

- **`createNotification(data)`** — Low-level helper that inserts a single `Notifications` record. Accepts `{ receiver_user_id, sender_user_id, type, content?, entity_id }`.
- **`notifyFriendRequest(receiverId, senderId, senderName, requestId)`** — Higher-level helper that:
  1. Creates a `Notifications` record first (FK requirement — `AddFriendRequests.id` references `Notifications.entity_id`)
  2. Creates the `AddFriendRequests` record with the same `id`
  3. Sends a real-time `notification:new` message via `sendToUser()` to the receiver's WebSocket

```typescript
export async function notifyFriendRequest(
  receiverId: string,
  senderId: string,
  senderName: string,
  requestId: string,
): Promise<{ notification: Record<string, unknown>; friendRequest: Record<string, unknown> }> {
  // Both records created inside $transaction: notification first, friend request second
  const [notification, friendRequest] = await prisma.$transaction(async (tx) => {
    const notif = await tx.notifications.create({
      data: {
        receiver_user_id: receiverId,
        sender_user_id: senderId,
        type: 'friend_request',
        content: `${senderName} sent you a friend request`,
        entity_id: requestId,
      },
    });
    const req = await tx.addFriendRequests.create({
      data: { id: requestId, sender_id: senderId, receiver_id: receiverId, status: 'pending' },
    });
    return [notif, req];
  });
  sendToUser(receiverId, { type: 'notification:new', payload: notification });
  return { notification, friendRequest };
}
```

### API Routes (`backend/src/routes/userNotification.ts`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/notifications` | Fetch notifications for the authenticated user (optional `?unread=true` filter, max 50) |
| `PATCH` | `/api/notifications/:id/read` | Mark a single notification as read |
| `PATCH` | `/api/notifications/read-all` | Mark all unread notifications as read |

### Notification Flow on Friend Request Actions

**Accepting** (`PATCH /api/friends/accept`):
1. Validates the friend request is pending and the user is the receiver
2. Updates `AddFriendRequests` status to `accepted`
3. Fetches the original notification via `findUnique({ where: { entity_id } })` (possible because `entity_id` is `@unique`) and checks `type === 'friend_request'` before updating it to `friend_request_accepted` with `read_at` set
4. Creates a DM chat via `createDmChat(senderId, userId, userId, senderUser.user_name, senderUser.image_url)` — `name` and `avatar_url` are persisted in the `StandardChats` table, storing the sender's name and avatar as the chat's display identity
5. Creates a `friend_request_accepted` notification for the original sender with `entity_id` set to the new DM chat's ID (so "Send Message" navigates correctly)
6. Sends `notification:new` and `chat:new` via WebSocket to **both** users

**Declining** (`PATCH /api/friends/:id/decline`):
1. Validates the friend request is pending and the user is the receiver
2. Updates `AddFriendRequests` status to `declined`
3. Creates a `friend_request_declined` notification for the original sender
4. Sends `notification:new` via WebSocket to the sender

## Frontend (`src/pages/NotificationsPage.tsx`)

### Features

- Fetches notifications on mount via `GET /api/notifications`
- Separates into **Unread** and **Read** sections
- Visual indicators: yellow dot for unread, yellow border for unread cards
- Relative timestamps ("just now", "3m ago", "2h ago")
- "Mark all as read" button
- Redux integration: resets `unreadNotifCount` on page visit

### Notification Types Rendering

| Type | Icon | Actions |
|------|------|---------|
| `friend_request` | UserPlus (purple) | Accept / Decline buttons |
 | `friend_request_accepted` | UserCheck (green) | "Send Message" button (navigates to the accepted DM chat via cache lookup) |
| `friend_request_declined` | UserX (red) | None (informational) |

### Optimistic Updates

- Mark as read: immediately updates local state, sends PATCH in background
- Accept/Decline: removes notification from list immediately
- Accept: dispatches `addChat` to Redux, seeds messages cache, calls `subscribeToChats`, then navigates to the new DM chat
- On error: `onError` callback resets loading state; `onSuccess` body is wrapped in `try/catch` so any thrown error (dispatch, cache, navigation) is caught and loading state is reset

### Loading State

- `AcceptLoadingModal` shown during the accept API call (prevents double-accept)

## Real-Time Delivery

The `WebSocketContext` listens for two relevant message types from the server:

### `notification:new`
When received, the client dispatches `incrementUnreadNotif` to Redux (updating the unread badge count) and prepends the notification to the TanStack Query cache.

```typescript
// In WebSocketContext.tsx
if (msg.type === 'notification:new') {
  dispatch(incrementUnreadNotif());
  queryClient.setQueryData<Notification[]>(notifKeys.lists(), (old) => {
    if (!old) return [msg.payload];
    return [msg.payload, ...old.filter((n) => n.id !== msg.payload.id)];
  });
}
```

### `chat:new`
When received (e.g., after a friend request is accepted), the client:
1. Dispatches `addChat` to Redux so the new DM appears in the sidebar immediately
2. Updates the TanStack Query cache for the chat list
3. **Automatically subscribes** the WebSocket to the new chat room via `subscribeToChats([newChatId])` — this also persists the chat ID into `subscribedChatsRef` so it survives reconnections, enabling real-time message delivery for both users without requiring a manual subscription or page refresh

## Key Files

| File | Role |
|------|------|
| `backend/src/services/userNotify.ts` | Notification creation (`createNotification`, `notifyFriendRequest`) and real-time delivery via `sendToUser` |
| `backend/src/routes/userNotification.ts` | REST API for fetching and managing notifications (uses `authenticate` middleware) |
| `backend/src/routes/userAddFriend.ts` | Friend request accept/decline with notification creation (uses `authenticate` middleware) |
| `backend/src/middleware/authenticate.ts` | JWT verification + cookie-based session refresh for all protected routes |
| `src/pages/NotificationsPage.tsx` | Notification feed UI with accept/decline actions |
| `src/store/userAuthSlice.tsx` | Redux state for `unreadNotifCount` |
| `src/context/WebSocketContext.tsx` | Real-time notification delivery to the frontend |
| `src/types/chat.ts` | `Notification` TypeScript interface |
