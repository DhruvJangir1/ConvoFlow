import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { chatKeys } from '../lib/queryKeys';
import type { Chat } from '../types/chat';
import { clerkFetch } from '../lib/clerkFetch';

async function fetchChatListAndExtract(chatId: string, userId: string): Promise<Chat> {
  const res = await clerkFetch(`/api/users/${userId}/fetch-chatNames`);
  if (!res.ok) throw new Error('Failed to fetch chats');
  const data = await res.json();
  const chats: Chat[] = data.chats ?? [];
  const chat = chats.find((c) => c.id === chatId);
  if (!chat) throw new Error('Chat not found');
  return chat;
}

export function useChatDetailQuery(chatId: string | undefined) {
  const queryClient = useQueryClient();
  const user = useSelector((s: RootState) => s.userAuth.user);

  const isEnabled = chatId !== '' && user !== null;

  return useQuery({
    queryKey: chatKeys.detail(chatId ?? ''),
    queryFn: () => {
      if (!chatId || !user) throw new Error('chatId or user is required');
      return fetchChatListAndExtract(chatId, user.id);
    },
    enabled: isEnabled,
    staleTime: 300_000,
    gcTime: 600_000,
    placeholderData: () => {
      if (!chatId) return undefined;
      const lists = queryClient.getQueryData<Chat[]>(chatKeys.lists());
      if (!lists) return undefined;
      return lists.find((c) => c.id === chatId);
    },
  });
}
