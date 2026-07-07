# Anonymous Chat Message Voting

## Overview

Users can upvote or downvote messages in anonymous chat rooms. The voting system supports toggling votes (click again to remove) and switching between upvote and downvote in a single action.

## Database

### AnonymousChatMessagesUserVotes

```prisma
model AnonymousChatMessagesUserVotes {
  id         String   @id @default(dbgenerated("gen_random_uuid()"))
  user_id    String
  mesage_id  String
  type       String?   // "upvote" | "downvote"
  created_at DateTime @default(now())

  @@index([user_id, mesage_id, type], map: "idx_anonymous_votes_user_message_type")
  @@schema("public")
}
```

One row per user per message. The composite index on `(user_id, mesage_id, type)` ensures fast lookups. Only one vote row per user per message exists at any time — enforced by the application logic inside `$transaction`.

### AnonymousChatMessages.TotalUpvotes

Denormalized counter on the message row:

```prisma
TotalUpvotes Int @default(0) @db.SmallInt
```

Updated atomically alongside vote records to avoid counting queries.

## Vote Service (`backend/src/services/userMessageVote.ts`)

Both `upvote()` and `downvote()` run inside `prisma.$transaction()` to prevent race conditions from concurrent requests. Each function finds the user's current vote for the message in a single query, then branches on the result:

### `upvote(userId, messageId)`

1. **Look up** the user's existing vote for this message (single `findFirst`).
2. **No existing vote** → Create `upvote` record, increment `TotalUpvotes` by **+1**.
3. **Existing `upvote`** → Remove record (toggle off), decrement `TotalUpvotes` by **-1**.
4. **Existing `downvote`** → Remove downvote, create upvote, adjust `TotalUpvotes` by **+2** (net effect: removing a downvote is +1, adding an upvote is +1).

### `downvote(userId, messageId)`

1. **Look up** the user's existing vote for this message (single `findFirst`).
2. **No existing vote** → Create `downvote` record, decrement `TotalUpvotes` by **-1**.
3. **Existing `downvote`** → Remove record (toggle off), increment `TotalUpvotes` by **+1**.
4. **Existing `upvote`** → Remove upvote, create downvote, adjust `TotalUpvotes` by **-2** (net effect: removing an upvote is -1, adding a downvote is -1).

### Vote Transition Summary

| Current Vote | Action Taken | TotalUpvotes Delta |
|-------------|-------------|-------------------|
| None → Upvote | Create upvote | +1 |
| Upvote → None | Delete upvote | -1 |
| Downvote → Upvote | Delete downvote + create upvote | +2 |
| None → Downvote | Create downvote | -1 |
| Downvote → None | Delete downvote | +1 |
| Upvote → Downvote | Delete upvote + create downvote | -2 |

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/anonymousChats/:id/messages/:messageId/upvote` | Upvote a message |
| `POST` | `/api/anonymousChats/:id/messages/:messageId/downvote` | Downvote a message |

Both routes call `authenticate` middleware and delegate to `upvote()`/`downvote()` from the service.

## Frontend Integration

### Voting State in Messages

Each message object includes:

```typescript
{
  totalUpvotes: number;
  userVote: 'upvote' | 'downvote' | null;
}
```

The `MessageList` component renders upvote/downvote buttons when `showVoting={true}`.

### Optimistic Updates (`src/pages/AnonymousChat.tsx`)

Votes update the local state immediately via `setMessages`, with rollback on mutation error. The mutation also invalidates the TanStack Query cache on settle to sync with server state:

```typescript
async function handleUpvote(messageId: string) {
  const prevMessages = [...messages];

  setMessages((prev) =>
    prev.map((m) => {
      if (m.id !== messageId) return m;
      const t = m.totalUpvotes ?? 0;
      if (m.userVote === "upvote") {
        return { ...m, totalUpvotes: t - 1, userVote: null };
      }
      if (m.userVote === "downvote") {
        return { ...m, totalUpvotes: t + 2, userVote: "upvote" };
      }
      return { ...m, totalUpvotes: t + 1, userVote: "upvote" };
    }),
  );

  voteMutation.mutate(
    { roomId, messageId, type: 'upvote' },
    { onError: () => setMessages(prevMessages) },
  );
}
```

### Fetching Vote State

When messages are fetched (`GET /:id/messages`), the backend queries `AnonymousChatMessagesUserVotes` for the current user and attaches `userVote` to each message. This ensures the UI reflects the correct vote state on page load.

```typescript
// Backend: for each message, check if the current user has voted
const userVotes = await prisma.anonymousChatMessagesUserVotes.findMany({
  where: { user_id: userId, mesage_id: { in: messageIds } },
  select: { mesage_id: true, type: true },
});
const voteMap = new Map(userVotes.map(v => [v.mesage_id, v.type]));
```

### Vote Rendering

The `MessageList` component:

- Shows an up arrow and down arrow next to each message
- Highlights the active vote (upvote = green/highlighted, downvote = red/highlighted)
- Displays the total score (`totalUpvotes`)
- Disables voting buttons during API calls (handled via rollback pattern)

## Key Files

| File | Role |
|------|------|
| `backend/src/services/userMessageVote.ts` | Upvote/downvote business logic with toggle support |
| `backend/src/routes/anonymousChat.ts` | Vote API endpoints (upvote/downvote routes) |
| `src/pages/AnonymousChat.tsx` | Frontend voting UI with optimistic updates |
| `src/components/MessageList.tsx` | Shared message rendering with voting mode |
| `prisma/schema.prisma` | `AnonymousChatMessagesUserVotes` table |
