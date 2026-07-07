# Anonymous Chatting Functionality

## Overview

Anonymous Chat rooms allow users to communicate without revealing their identity. Messages can be sent anonymously (default) or with the user's real name attached, toggled per-message via a UI switch.

## Database Models

### AnonymousChats

Represents an anonymous chat room:

```prisma
model AnonymousChats {
  id                   String                  @id
  name                 String?
  avatar_url           String?
  created_at           DateTime
  updated_at           DateTime?
  AnonymousChatMembers  AnonymousChatMembers[]
  AnonymousChatMessages AnonymousChatMessages[]
  DailyPolls            DailyPolls?
}
```

### AnonymousChatMembers

Tracks which users have joined a room:

```prisma
model AnonymousChatMembers {
  id             String         @id
  created_at     DateTime
  is_verified    Boolean?       @default(false)
  chat_id        String
  // Relations to AnonymousChats and USERS
}
```

### AnonymousChatMessages

Stores messages within anonymous chat rooms:

```prisma
model AnonymousChatMessages {
  id           String         @id
  created_at   DateTime
  content      String?
  chat_id      String
  message_type String         @default("text")
  is_edited    Boolean        @default(false)
  status       String         @default("sent")
  sender_id    String?
  TotalUpvotes Int            @default(0)
  lastVoted    DateTime?
  isAnonymous  Boolean        @default(false)
  // Relation to AnonymousChats
}
```

Key columns:
- `isAnonymous` — controls whether the sender's identity is hidden (`true`) or revealed (`false`)
- `sender_id` — always stores the real user ID (for ownership checks), even when anonymous
- `TotalUpvotes` — denormalized vote count for performance

## Backend API (`backend/src/routes/anonymousChat.ts`)

### Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/anonymousChats` | List anonymous chat rooms (latest 20) |
| `GET` | `/api/anonymousChats/:id` | Get a single room's details |
| `POST` | `/api/anonymousChats/:id/join` | Join an anonymous chat room (creates membership) |
| `GET` | `/api/anonymousChats/:id/messages` | Get messages (with cursor-based pagination via `?before=`) |
| `POST` | `/api/anonymousChats/:id/messages/:userId/:isAnonymous` | Send a message |
| `PATCH` | `/api/anonymousChats/:id/messages/:messageId` | Edit a message |
| `DELETE` | `/api/anonymousChats/:id/messages/:messageId` | Delete a message |
| `POST` | `/api/anonymousChats/:id/messages/:messageId/upvote` | Upvote a message |
| `POST` | `/api/anonymousChats/:id/messages/:messageId/downvote` | Downvote a message |

### Sending Messages (`POST /:id/messages/:userId/:isAnonymous`)

1. Validates content (non-empty string)
2. Creates `AnonymousChatMessages` row with `sender_id`, `chat_id`, `content`, and `isAnonymous` flag
3. If **not anonymous**: fetches the user's `user_name` and `image_url` for the broadcast
4. If **anonymous**: sender info is `null` (client shows "Anonymous")
5. Broadcasts `message:new` via WebSocket to the room

### Fetching Messages (`GET /:id/messages`)

1. Queries `AnonymousChatMessages` ordered by `created_at` desc, limit 20
2. For non-anonymous messages, fetches the corresponding `users` data
3. Fetches the current user's votes on those messages
4. Returns messages with user vote state (`userVote: 'upvote' | 'downvote' | null`)

### Joining a Room (`POST /:id/join`)

- Creates an `AnonymousChatMembers` record if one doesn't already exist
- Idempotent: returns success if already a member

## Frontend (`src/pages/AnonymousChat.tsx`)

### Key Features

- **Anonymous Toggle**: `ChatInput` component includes a toggle (`isAnonymous` state) that determines the `isAnonymous` flag when sending
- **Identity Hiding**: Anonymous messages show `senderName: "Anonymous"` and `senderImage: null`; non-anonymous show the real user info
- **Deterministic Avatars**: Users without profile images get a gradient avatar generated from the room name hash (`hashToHue` function)
- **Ownership Tracking**: Uses `ownMessageIds` Set to track messages sent by the current user (for edit/delete permissions)
- **Message Voting**: Upvote/downvote buttons with optimistic UI updates

### Data Flow

1. Component mounts with `roomId` from URL params
2. Subscribes to the chat room via WebSocket (`subscribeToChats([roomId])`)
3. Fetches room details and initial messages (20 most recent)
4. Listens for real-time `message:new` events via WebSocket
5. On send: POSTs to REST API, adds optimistic message with temp ID, replaces on success
6. On scroll-to-top: fetches older messages using cursor-based pagination (`?before=`)

### Optimistic Updates

- **Send**: Message appears immediately with `temp-` prefixed ID
- **Edit**: Content updates immediately, reverts on API failure
- **Delete**: Message removed immediately, restored on API failure
- **Vote**: Count and state update immediately, revert on API failure

### Voting UI

The `MessageList` component receives `showVoting={true}` and `showReactions={false}` props for anonymous chats. Upvote/downvote handlers perform optimistic updates and then POST to the API.

## WebSocket Integration

Anonymous messages use the same WebSocket infrastructure as standard chats. The key difference is the `isAnonymous` field in the `message:new` payload:

```typescript
broadcastToRoom(chatId, {
  type: 'message:new',
  payload: {
    id: message.id,
    chatId,
    content: message.content,
    createdAt: message.created_at,
    senderId: userId,
    senderName: isAnon ? null : senderName,
    senderImage: isAnon ? null : senderImage,
    isAnonymous: isAnon,
  },
});
```

The client-side `onMessage` handler in `AnonymousChat.tsx` uses the `isAnonymous` flag to determine whether to show "Anonymous" or the real sender name.

## Key Files

| File | Role |
|------|------|
| `backend/src/routes/anonymousChat.ts` | All REST endpoints for anonymous chat CRUD |
| `src/pages/AnonymousChat.tsx` | Full anonymous chat UI with voting, editing, deleting |
| `src/components/ChatInput.tsx` | Input component with anonymous toggle |
| `src/components/MessageList.tsx` | Shared message list component (voting mode for anonymous) |
| `prisma/schema.prisma` | Database models: `AnonymousChats`, `AnonymousChatMembers`, `AnonymousChatMessages` |
