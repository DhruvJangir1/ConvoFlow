import { useQuery } from '@tanstack/react-query';
import { clerkFetch } from '../lib/clerkFetch';
import { userKeys } from '../lib/queryKeys';
import type { UserProfile } from '../types/chat';

async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const res = await clerkFetch(`/api/users/${userId}/profile`);
  if (!res.ok) throw new Error('Failed to fetch user profile');
  const data = await res.json();
  return data.user as UserProfile;
}

export function useUserProfileQuery(userId: string | null) {
  return useQuery({
    queryKey: userKeys.profile(userId ?? ''),
    queryFn: () => {
      if (!userId) throw new Error('userId is required');
      return fetchUserProfile(userId);
    },
    enabled: userId !== null && userId !== '',
    staleTime: 300_000,
    gcTime: 600_000,
  });
}
