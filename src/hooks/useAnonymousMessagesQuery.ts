import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { MutableRefObject } from 'react';
import type { RootState } from '../store/store';
import { anonChatKeys } from '../lib/queryKeys';
import type { AnonymousChatMessages } from '../types/chat';

export interface AnonymousMessagesResponse {
  messages: AnonymousChatMessages[];
  hasMore: boolean;
}

function buildAnonMessage(
  m: {
    id: string;
    content: string | null;
    created_at: string;
    is_edited: boolean;
    TotalUpvotes: number;
    userVote?: string | null;
    isAnonymous: boolean;
    sender_id: string;
    users: { id: string; user_name: string; image_url: string | null } | null;
  },
  chatId: string,
  userId: string,
  userImageUrl: string | null,
  ownIdsRef: MutableRefObject<Set<string>>,
): AnonymousChatMessages {
  const isOwn = ownIdsRef.current.has(m.id) || m.sender_id === userId;
  const isAnon = m.isAnonymous ?? true;
  return {
    id: m.id,
    chatId,
    senderId: isOwn ? userId : (isAnon ? 'other' : (m.users?.id ?? 'other')),
    senderName: isAnon ? 'Anonymous' : (isOwn ? userId : (m.users?.user_name ?? 'Anonymous')),
    senderImage: isAnon ? null : (isOwn ? userImageUrl : (m.users?.image_url ?? null)),
    content: m.content ?? '',
    createdAt: m.created_at,
    isOwn,
    isEdited: m.is_edited ?? false,
    messageType: 'text',
    totalUpvotes: m.TotalUpvotes ?? 0,
    userVote: (m.userVote as 'upvote' | 'downvote' | null) ?? null,
    isAnonymous: isAnon,
  };
}

async function fetchAnonymousMessages(
  roomId: string,
  userId: string,
  userImageUrl: string | null,
  ownIdsRef: MutableRefObject<Set<string>>,
  before?: string,
): Promise<AnonymousMessagesResponse> {
  const url = before
    ? `/api/anonymousChats/${roomId}/messages?before=${encodeURIComponent(before)}`
    : `/api/anonymousChats/${roomId}/messages`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch anonymous messages');
  const data = await res.json();
  const msgs = (data.messages ?? []).map((m: Parameters<typeof buildAnonMessage>[0]) =>
    buildAnonMessage(m, roomId, userId, userImageUrl, ownIdsRef),
  );
  return { messages: msgs, hasMore: data.hasMore ?? false };
}

export function useAnonymousMessagesQuery(
  roomId: string | undefined,
  ownIdsRef: MutableRefObject<Set<string>>,
) {
  const user = useSelector((s: RootState) => s.userAuth.user);
  if (!user) throw new Error('User must be authenticated to fetch anonymous messages');

  const isEnbaled = roomId !== null && user !== null;

  return useQuery({
    queryKey: anonChatKeys.messages(roomId!),
    queryFn: () => fetchAnonymousMessages(roomId!, user.id, user.image_url, ownIdsRef),
    enabled: isEnbaled,
    staleTime: 300_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });
}
