import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { chatKeys } from '../lib/queryKeys';
import type { Chat } from '../types/chat';

async function fetchChats(): Promise<Chat[]> {
  const res = await fetch('/api/chats', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch chats');
  const data = await res.json();
  return data.chats ?? [];
}

export function useChatsQuery() {
  const user = useSelector((s: RootState) => s.userAuth.user);

  const isEnabled = user !== null;

  return useQuery({
    queryKey: chatKeys.lists(),
    queryFn: fetchChats,
    enabled: isEnabled,
    staleTime: 300_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });
}
