import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { chatKeys } from '../lib/queryKeys';
import type { ChatMessages } from '../types/chat';

export interface MessagesResponse {
  messages: ChatMessages[];
  hasMore: boolean;
}

async function fetchMessages(chatId: string, userId: string, before?: string): Promise<MessagesResponse> {
  const url = before
    ? `/api/chats/${chatId}/messages?before=${encodeURIComponent(before)}`
    : `/api/chats/${chatId}/messages`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch messages');
  const data = await res.json();
  const msgs = data.messages.map((m: { id: string; sender_id: string; content: string; created_at: string; is_edited?: boolean; message_type?: string; USERS?: { user_name: string; image_url: string | null } | null }) => ({
    id: m.id,
    senderId: m.sender_id,
    senderName: m.USERS?.user_name ?? m.sender_id.slice(0, 8),
    senderImage: m.USERS?.image_url ?? null,
    content: m.content,
    createdAt: m.created_at,
    isOwn: m.sender_id === userId,
    isEdited: m.is_edited ?? false,
    messageType: m.message_type,
  }));
  return { messages: msgs, hasMore: data.hasMore ?? false };
}

export function useChatMessagesQuery(chatId: string | undefined) {
  const user = useSelector((s: RootState) => s.userAuth.user);

  const isEnabled = chatId !== "" && user !== null;

  return useQuery({
    queryKey: chatKeys.messages(chatId ?? ''),
    queryFn: () => fetchMessages(chatId!, user!.id),
    enabled: isEnabled,
    staleTime: 300_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });
}
