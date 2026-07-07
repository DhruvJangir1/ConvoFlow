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

One row per user per message per vote type. The composite index on `(user_id, mesage_id, type)` ensures fast lookups.

### AnonymousChatMessages.TotalUpvotes

Denormalized counter on the message row:

```prisma
TotalUpvotes Int @default(0) @db.SmallInt
```

Updated atomically alongside vote records to avoid counting queries.

## Vote Service (`backend/src/services/userMessageVote.ts`)

### `upvote(userId, messageId)`

1. Check if user already has an `upvote` record → if yes, **remove** the vote (toggle off), decrement count by 1
2. Check if user has a `downvote` record → if yes, **remove** the downvote, increment count by 1 (net +2 from the toggle: removing -1 then adding +1)
3. Create an `upvote` record, increment count by 1

Return: `{ success: true, action: 'removed' | 'added' }`

### `downvote(userId, messageId)`

1. Check if user already has a `downvote` record → if yes, **remove** the vote (toggle off), increment count by 1
2. Check if user has an `upvote` record → if yes, **remove** the upvote, decrement count by 1
3. Create a `downvote` record
4. Only decrement count if current total is greater than 0 (prevents negative scores)

Return: `{ success: true, action: 'removed' | 'added' }`

### Vote Transition Summary

| Current Vote | Action Taken | TotalUpvotes Delta |
|-------------|-------------|-------------------|
| None → Upvote | Create upvote | +1 |
| Upvote → None | Delete upvote | -1 |
| Downvote → Upvote | Delete downvote + create upvote | +2 |
| None → Downvote | Create downvote | -1 (if > 0) |
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
