import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { chatKeys } from '../lib/queryKeys';
import type { Chat } from '../types/chat';
import { clerkFetch } from '../lib/clerkFetch';

export function useChatsQuery() {
  const user = useSelector((s: RootState) => s.userAuth.user);

  const isEnabled = user !== null;

  return useQuery({
    queryKey: chatKeys.lists(),
    queryFn: async (): Promise<Chat[]> => {
      if (!user) return [];
      const res = await clerkFetch(`/api/users/${user.id}/fetch-chatNames`);
      if (!res.ok) throw new Error('Failed to fetch chats');
      const data = await res.json();
      return data.chats ?? [];
    },
    enabled: isEnabled,
    staleTime: 300_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });
}
