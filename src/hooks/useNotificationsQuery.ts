import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { notifKeys } from '../lib/queryKeys';
import type { Notification } from '../types/chat';
import { clerkFetch } from '../lib/clerkFetch';

async function fetchNotifications(): Promise<Notification[]> {
  const res = await clerkFetch('/api/notifications');
  if (!res.ok) throw new Error('Failed to fetch notifications');
  const data = await res.json();
  return data.notifications ?? [];
}

export function useNotificationsQuery() {
  const user = useSelector((s: RootState) => s.userAuth.user);

  const isEnabled = user !== null;

  return useQuery({
    queryKey: notifKeys.lists(),
    queryFn: fetchNotifications,
    enabled: isEnabled,
    staleTime: 300_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });
}
