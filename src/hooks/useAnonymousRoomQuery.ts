import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { anonChatKeys } from '../lib/queryKeys';
import type { AnonymousRoom } from './useAnonymousRoomsQuery';
import { clerkFetch } from '../lib/clerkFetch';

async function fetchAnonymousRoomDetail(roomId: string): Promise<AnonymousRoom> {
  const res = await clerkFetch(`/api/anonymousChats/${roomId}`);
  if (!res.ok) throw new Error('Failed to fetch anonymous room');
  const data = await res.json();
  if (!data.chat) throw new Error('Anonymous room not found');
  return data.chat;
}

export function useAnonymousRoomQuery(roomId: string | undefined) {
  const queryClient = useQueryClient();
  const user = useSelector((s: RootState) => s.userAuth.user);

  const isEnabled = roomId !== '' && user !== null;

  return useQuery({
    queryKey: anonChatKeys.detail(roomId ?? ''),
    queryFn: () => fetchAnonymousRoomDetail(roomId as string ),
    enabled: isEnabled,
    staleTime: 300_000,
    gcTime: 600_000,
    placeholderData: () => {
      if (!roomId) return undefined;
      const list = queryClient.getQueryData<AnonymousRoom[]>(anonChatKeys.lists());
      return list?.find((r) => r.id === roomId) ?? undefined;
    },
  });
}
