import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { MutableRefObject } from 'react';
import type { RootState } from '../store/store';
import { anonChatKeys } from '../lib/queryKeys';
import type { AnonymousChatMessages, MessageCursor } from '../types/chat';
import { clerkFetch } from '../lib/clerkFetch';

export interface AnonymousMessagesResponse {
  messages: AnonymousChatMessages[];
  hasMore: boolean;
  nextCursor: MessageCursor | null;
}

function buildAnonMessage(
  m: {
    id: string;
    content: string | null;
    created_at: string;
    is_edited: boolean;
    isAnonymous: boolean;
    sender_id: string;
    users: { id: string; user_name: string; image_url: string | null } | null;
  },
  chatId: string,
  userId: string,
  userName: string,
  userImageUrl: string | null,
  ownIdsRef: MutableRefObject<Set<string>>,
): AnonymousChatMessages {
  const isOwn = ownIdsRef.current.has(m.id) || m.sender_id === userId;
  const isAnon = m.isAnonymous;
  return {
    id: m.id,
    chatId,
    senderId: isOwn ? userId : (isAnon ? 'other' : (m.users ? m.users.id : 'other')),
    senderName: isAnon ? 'Anonymous' : (isOwn ? userName : (m.users ? m.users.user_name : 'Anonymous')),
    senderImage: isAnon ? null : (isOwn ? userImageUrl : (m.users ? m.users.image_url : null)),
    content: m.content ?? '',
    createdAt: m.created_at,
    isOwn,
    isEdited: m.is_edited,
    messageType: 'text',
    isAnonymous: isAnon,
  };
}

async function fetchAnonymousMessages(
  roomId: string,
  userId: string,
  userName: string,
  userImageUrl: string | null,
  ownIdsRef: MutableRefObject<Set<string>>,
  cursor?: MessageCursor,
): Promise<AnonymousMessagesResponse> {
  const url = cursor
    ? `/api/anonymousChats/${roomId}/messages?beforeCreatedAt=${encodeURIComponent(cursor.beforeCreatedAt)}&beforeId=${encodeURIComponent(cursor.beforeId)}`
    : `/api/anonymousChats/${roomId}/messages`;
  const res = await clerkFetch(url);
  if (!res.ok) throw new Error('Failed to fetch anonymous messages');
  const data = await res.json();
  const msgs = (data.messages ?? []).map((m: Parameters<typeof buildAnonMessage>[0]) =>
    buildAnonMessage(m, roomId, userId, userName, userImageUrl, ownIdsRef),
  );
  return { messages: msgs, hasMore: data.hasMore === true, nextCursor: data.nextCursor ? data.nextCursor : null };
}

export function useAnonymousMessagesQuery(
  roomId: string | undefined,
  ownIdsRef: MutableRefObject<Set<string>>,
) {
  const user = useSelector((s: RootState) => s.userAuth.user);
  if (!user) throw new Error('User must be authenticated to fetch anonymous messages');

  const isEnbaled = roomId !== null && user !== null;

  return useQuery({
    queryKey: anonChatKeys.messages(roomId ?? ''),
    queryFn: () => {
      if (!roomId) throw new Error('Anonymous room ID is required');
      return fetchAnonymousMessages(roomId, user.id, user.user_name, user.image_url, ownIdsRef);
    },
    enabled: isEnbaled,
    staleTime: 300_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });
}
