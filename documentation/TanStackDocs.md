# TanStack Query Cache System

## Overview

ConvoFlow uses **@tanstack/react-query v5** as the server-state caching layer for chat data. The chat list (sidebar conversations) is fetched once and cached; mutations automatically update the cache so the UI stays in sync without manual refetching.

The system follows this pattern:

1. **`useQuery`** → fetch and cache the chat list
2. **`useMutation`** → perform create/update/delete operations, then reflect changes directly in the cache via `onSuccess` / `onMutate` / `setQueryData`
3. **WebSocket events** → `chat:new` events also update the cache

Redux (`chatSlice`) is kept in sync via `useEffect` for backward compatibility with existing components, but TanStack Query is the source of truth.

---

## Query Key Factory (`src/lib/queryKeys.ts`)

Centralized, type-safe query keys prevent key collisions across the app.

```typescript
export const chatKeys = {
  all: ['chats'] as const,
  lists: () => [...chatKeys.all, 'list'] as const,
  list: (filters?: Record<string, string>) => [...chatKeys.lists(), filters] as const,
  details: () => [...chatKeys.all, 'detail'] as const,
  detail: (chatId: string) => [...chatKeys.details(), chatId] as const,
  messages: (chatId: string) => ['chats', chatId, 'messages'] as const,
};
```

### Usage

| Key | Cache Contents |
|-----|----------------|
| `chatKeys.lists()` | `['chats', 'list']` → array of `Chat[]` |
| `chatKeys.messages(chatId)` | `['chats', chatId, 'messages']` → array of `ChatMessages[]` |
| `chatKeys.detail(chatId)` | `['chats', 'detail', chatId]` → single `Chat` object (reserved) |

---

## Hooks

### `useChatsQuery` (`src/hooks/useChatsQuery.ts`)

Fetches `GET /api/chats` and caches the result.

```typescript
function useChatsQuery(): UseQueryResult<Chat[]>
```

- **Enabled only when user is authenticated** (reads from Redux `userAuth.user`)
- **Stale time**: 5 minutes (data considered fresh, no background refetch)
- **gcTime**: 10 minutes (data persists in memory after unmount)
- **No refetch on window focus** (prevents flickering)
- Returns `Chat[]` (the `data.chats` array from the API response)

### `useChatMessagesQuery` (`src/hooks/useChatMessagesQuery.ts`)

Fetches messages for a specific chat via `GET /api/chats/:chatId/messages`.

```typescript
function useChatMessagesQuery(chatId: string | undefined): UseQueryResult<MessagesResponse>
```

- Only enabled when `chatId` and `user` are present
- Returns `{ messages: ChatMessages[], hasMore: boolean }`
- Each message is transformed with `buildMessage()` (sets `isOwn`, `senderName`, etc.)

---

## Mutations (`src/hooks/useChatMutations.ts`)

### `useSendMessageMutation`

Calls `POST /api/chats/:chatId/:userId/appendMessage` (REST fallback when WebSocket is unavailable).

**Cache update on success:**
- Updates the specific chat's `lastMessage` and `timestamp` in the chat list cache

```typescript
const mutation = useSendMessageMutation();
mutation.mutate({ chatId, content, userId });
```

### `useEditMessageMutation`

Calls `PATCH /api/chats/:chatId/messages/:messageId/:userId`.

**Cache update strategy (optimistic):**
- `onMutate` → immediately updates the message content in the messages cache
- `onError` → rolls back to the previous messages cache snapshot
- `onSettled` → invalidates the chat list query (to update `lastMessage`)

```typescript
const mutation = useEditMessageMutation();
mutation.mutate({ chatId, messageId, content, userId });
```

### `useDeleteMessageMutation`

Calls `DELETE /api/chats/:chatId/messages/:messageId/:userId`.

**Cache update strategy (optimistic):**
- `onMutate` → immediately removes the message from the messages cache
- `onError` → rolls back to the previous messages cache snapshot
- `onSettled` → invalidates the chat list query

```typescript
const mutation = useDeleteMessageMutation();
mutation.mutate({ chatId, messageId, userId });
```

### `useCreateChatMutation`

Calls `POST /api/chats` to create a DM or group chat.

**Cache update on success:**
- Prepends the new chat to the chat list cache
- Also dispatches `addChat` to Redux for immediate sidebar update

```typescript
const mutation = useCreateChatMutation();
mutation.mutate({ type: 'dm', participantIds: ['user-id'] });
```

### `useUpdateChatsCache`

Utility hook for directly manipulating the chat list cache without an API call (used by WebSocket and real-time handlers).

```typescript
const { addChatToCache, updateChatInCache, removeChatFromCache } = useUpdateChatsCache();

addChatToCache(newChat);
updateChatInCache(chatId, { lastMessage: '...', timestamp: Date.now() });
removeChatFromCache(chatId);
```

---

## Cache Update Flow

### Chat List Cache (`['chats', 'list']`)

```
Event                         Cache Action
─────                         ────────────
Page load / user logs in      useQuery fetches GET /api/chats → cached
Send message (REST fallback)  onSuccess: update lastMessage/timestamp
Edit message                  onSettled: invalidate query
Delete message                onSettled: invalidate query
Create chat (mutation)        onSuccess: prepend to cache
Create chat (WebSocket)       setQueryData: prepend to cache
Accept friend request         setQueryData: prepend new chat
New DM from user search       invalidateQueries → refetch
```

### Messages Cache (`['chats', chatId, 'messages']`)

```
Event                         Cache Action
─────                         ────────────
Open chat                     useQuery fetches GET /api/chats/:id/messages → cached
Send message (optimistic)     N/A (handled by local state + WebSocket ack)
Edit message                  onMutate: optimistic update; onError: rollback
Delete message                onMutate: optimistic remove; onError: rollback
```

---

## Integration with WebSocket

In `WebSocketContext.tsx`, real-time events update both Redux and the TanStack cache:

```typescript
// src/context/WebSocketContext.tsx
if (msg.type === 'chat:new') {
  dispatch(addChat(msg.payload.chat));
  queryClient.setQueryData<Chat[]>(chatKeys.lists(), (old) => {
    if (!old) return [msg.payload.chat];
    return [msg.payload.chat, ...old.filter((c) => c.id !== msg.payload.chat.id)];
  });
}

if (msg.type === 'notification:new') {
  dispatch(incrementUnreadNotif());
  queryClient.setQueryData<Notification[]>(notifKeys.lists(), (old) => {
    if (!old) return [msg.payload];
    return [msg.payload, ...old.filter((n) => n.id !== msg.payload.id)];
  });
}
```

This ensures:
- **New chats** appear instantly in the sidebar (list cache updated)
- **New notifications** appear instantly in the notifications page (list cache updated)
- The unread badge count increments in real-time

---

## Backward Compatibility with Redux

`ChatContext.tsx` bridges TanStack Query and Redux:

```typescript
// src/context/ChatContext.tsx
export function ChatProvider({ children }) {
  const dispatch = useDispatch();
  const { data: chats, isLoading, refetch } = useChatsQuery();

  useEffect(() => {
    dispatch(setChats(chats ?? []));
  }, [chats, dispatch]);

  // ...
}
```

Existing components that read `s.chat.chats` from Redux continue to work. The `useChats()` hook still exposes `{ loading, refetchChats }` for components that need to trigger a manual refetch.

---

---

## Anonymous Chats

Anonymous chat rooms use a separate cache namespace (`anonChatKeys`) with the same patterns.

### Query Key Factory (`anonChatKeys` in `src/lib/queryKeys.ts`)

| Key | Cache Contents |
|-----|----------------|
| `anonChatKeys.lists()` | `['anonymousChats', 'list']` → array of `{ id, name }` |
| `anonChatKeys.detail(roomId)` | `['anonymousChats', 'detail', roomId]` → single room `{ id, name }` |
| `anonChatKeys.messages(roomId)` | `['anonymousChats', roomId, 'messages']` → array of `ChatMessages[]` |

### Hooks

| Hook | Description | Cache Check Order |
|------|-------------|-------------------|
| `useAnonymousRoomsQuery()` | Fetches `GET /api/anonymousChats` (room list) | 1. List cache → 2. API |
| `useAnonymousRoomQuery(roomId)` | Fetches `GET /api/anonymousChats/:id` (single room) | 1. Detail cache → 2. List cache (placeholder) → 3. API |
| `useAnonymousMessagesQuery(roomId, ownIds)` | Fetches `GET /api/anonymousChats/:id/messages` | 1. Messages cache → 2. API |

### Mutations (`src/hooks/useAnonymousMutations.ts`)

| Mutation | API Call | Cache Action |
|----------|----------|--------------|
| `useAnonymousSendMessageMutation` | `POST /api/anonymousChats/:id/messages/:userId/:isAnonymous` | `onSettled` → invalidate messages cache |
| `useAnonymousEditMessageMutation` | `PATCH /api/anonymousChats/:id/messages/:messageId` | `onSettled` → invalidate messages cache |
| `useAnonymousDeleteMessageMutation` | `DELETE /api/anonymousChats/:id/messages/:messageId` | `onSettled` → invalidate messages cache |
| `useAnonymousVoteMutation` | `POST /api/anonymousChats/:messageId/upvote` or `/downvote` | `onSettled` → invalidate messages cache |

### Cache Update Flow

```
Event                         Cache Action
─────                         ────────────
Open anonymous chat list      useQuery fetches GET /api/anonymousChats → cached
Open anonymous room           useAnonymousRoomQuery → detail cache (fallback: list cache)
View room messages            useAnonymousMessagesQuery → messages cache
Send message                  mutation → invalidate messages cache
Edit/delete message           mutation → invalidate messages cache
Upvote/downvote               mutation → invalidate messages cache
```

---

## Notifications

Notifications use a separate cache namespace (`notifKeys`) with the same cache-first pattern.

### Query Key Factory (`notifKeys` in `src/lib/queryKeys.ts`)

| Key | Cache Contents |
|-----|----------------|
| `notifKeys.lists()` | `['notifications', 'list']` → array of `Notification[]` |

### Hooks and Mutations (`src/hooks/useNotificationMutations.ts`)

| Hook | API Call | Cache Action |
|------|----------|--------------|
| `useNotificationsQuery()` | `GET /api/notifications` | Cache for 5 min / persist 10 min |
| `useMarkNotificationRead()` | `PATCH /api/notifications/:id/read` | `onSettled` → invalidate list |
| `useMarkAllNotificationsRead()` | `PATCH /api/notifications/read-all` | `onSettled` → invalidate list |
| `useDeclineFriendRequest()` | `PATCH /api/friends/:id/decline` | `onSettled` → invalidate list |
| `useAcceptFriendRequest()` | `PATCH /api/friends/accept` | `onSuccess` → update chat list cache; `onSettled` → invalidate notification list |

### Cache Lookup Order

1. **Notification list** → `notifKeys.lists()` → cache → `GET /api/notifications`

### Friend Request Accept Flow (`src/pages/NotificationsPage.tsx`)

When a user accepts a friend request, the UI follows a decoupled navigation pattern using a `newChatId` state variable:

```
1. User clicks Accept
2. setAcceptLoading(true)        → AcceptLoadingModal spinner shows
3. acceptMutation.mutate(...)    → API call starts (spinner keeps spinning)
4. Mutation onSuccess runs first → updates TanStack chat list cache (setQueryData)
5. On success (call-site):
   a. Safety check: data.chat?.id must be present
   b. setNewChatId(chatId)       → triggers useEffect
   c. dispatch(addChat(newChat)) → updates Redux sidebar
6. onSettled runs                → setAcceptLoading(false), modal hides
7. useEffect fires               → navigate(/chat/:newChatId)
8. Component unmounts
9. On error:
   setAcceptLoading(false)       → modal hides so user can retry
```

This ensures the spinner stays visible continuously from click until navigation, with no flash. Navigation is triggered via `useEffect` watching `newChatId`, not inside the mutation callback directly.

### "Send Message" from `friend_request_accepted` Notification

When the original friend request sender clicks "Send Message" on an accepted notification, the `handleCreateChat` callback navigates to the correct chat:

1. Reads the `chatKeys.lists()` cache to find a DM chat whose members include `notification.sender_user_id` (the user who accepted)
2. If found, navigates to `/chat/{match.id}`
3. Falls back to `notification.entity_id` (which was previously a random UUID — now fixed in the backend to store `chatId`)

---

## Key Files

| File | Role |
|------|------|
| `src/lib/queryKeys.ts` | Query key factory for chats, messages, anonymous chats, and notifications |
| `src/hooks/useChatsQuery.ts` | `useQuery` for fetching the chat list |
| `src/hooks/useChatDetailQuery.ts` | `useQuery` for fetching a single chat's details (3-tier cache) |
| `src/hooks/useChatMessagesQuery.ts` | `useQuery` for fetching messages per chat |
| `src/hooks/useChatMutations.ts` | All chat `useMutation` hooks with cache update logic |
| `src/hooks/useAnonymousRoomsQuery.ts` | `useQuery` for fetching the anonymous room list |
| `src/hooks/useAnonymousRoomQuery.ts` | `useQuery` for a single anonymous room (2-tier cache) |
| `src/hooks/useAnonymousMessagesQuery.ts` | `useQuery` for anonymous room messages |
| `src/hooks/useAnonymousMutations.ts` | All anonymous chat `useMutation` hooks |
| `src/hooks/useNotificationsQuery.ts` | `useQuery` for fetching notifications list |
| `src/hooks/useNotificationMutations.ts` | All notification `useMutation` hooks |
| `src/context/ChatContext.tsx` | Bridges TanStack cache → Redux for backward compat |
| `src/context/WebSocketContext.tsx` | Updates TanStack cache on real-time `chat:new` and `notification:new` events |
| `src/pages/ChatView.tsx` | Consumes mutations for send/edit/delete (REST fallback) |
| `src/pages/AnonymousChat.tsx` | Consumes anonymous cache hooks + mutations |
| `src/pages/NotificationsPage.tsx` | Consumes notification query + mutations; updates chat cache on accept |
| `src/layouts/ChatList.tsx` | Uses `useAnonymousRoomsQuery` for room list |
| `src/modals/UserSearchModal.tsx` | Invalidates cache when creating a new DM |
