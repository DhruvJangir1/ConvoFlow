import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifKeys, chatKeys } from '../lib/queryKeys';
import type { Chat } from '../types/chat';
import { clerkFetch } from '../lib/clerkFetch';

/* ───── Mark Single Read ───── */
async function markRead(id: string) {
  const res = await clerkFetch(`/api/notifications/${id}/read`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error('Failed to mark as read');
  return res.json();
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markRead,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notifKeys.lists() });
    },
  });
}

/* ───── Mark All Read ───── */
async function markAllRead() {
  const res = await clerkFetch('/api/notifications/read-all', {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error('Failed to mark all as read');
  return res.json();
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllRead,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notifKeys.lists() });
    },
  });
}

/* ───── Reject Friend Request ───── */
async function rejectFriendRequest(entityId: string) {
  const res = await clerkFetch(`/api/friends/${entityId}/reject`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error);
  }
}

export function useRejectFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rejectFriendRequest,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notifKeys.lists() });
    },
  });
}

/* ───── Accept Friend Request ───── */
interface AcceptFriendResponse {
  chat: { id: string; name?: string; avatar_url?: string | null };
  senderName?: string;
}

async function acceptFriendRequest(notification: { id: string; sender_user_id: string }): Promise<AcceptFriendResponse> {
  const res = await clerkFetch('/api/friends/accept', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notification }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error);
  }
  return res.json();
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: (data, notification) => {
      const newChat: Chat = {
        id: data.chat.id,
        name: data.chat.name ?? data.senderName ?? 'Unknown',
        avatar_url: data.chat.avatar_url ?? null,
        lastMessage: '',
        timestamp: Date.now(),
        unread: 0,
        type: 'dm',
        messageCount: 0,
        members: [{
          id: notification.sender_user_id,
          user_name: data.senderName ?? 'Unknown',
          image_url: null,
        }],
      };
      queryClient.setQueryData<Chat[]>(chatKeys.lists(), (old) => {
        if (!old) return [newChat];
        return [newChat, ...old.filter((c) => c.id !== newChat.id)];
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notifKeys.lists() });
    },
  });
}
