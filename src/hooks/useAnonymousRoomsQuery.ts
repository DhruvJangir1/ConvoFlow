import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { anonChatKeys } from '../lib/queryKeys';
import { clerkFetch } from '../lib/clerkFetch';

export interface AnonymousRoom {
  id: string;
  name: string;
  lastMessage: string | null;
  timestamp: number;
}

async function fetchAnonymousRooms(): Promise<AnonymousRoom[]> {
  const res = await clerkFetch('/api/anonymousChats');
  if (!res.ok) throw new Error('Failed to fetch anonymous rooms');
  const data = await res.json();
  return data.chats ?? [];
}

export function useAnonymousRoomsQuery() {
  const user = useSelector((s: RootState) => s.userAuth.user);

  const isEnabled = user ? true : false

  return useQuery({
    queryKey: anonChatKeys.lists(),
    queryFn: fetchAnonymousRooms,
    enabled: isEnabled,
    staleTime: 300_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });
}
