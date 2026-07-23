import { useMutation, useQueryClient } from '@tanstack/react-query';
import { anonChatKeys } from '../lib/queryKeys';
import { clerkFetch } from '../lib/clerkFetch';

/* ───── Send Message ───── */
interface SendAnonMessageVars {
  roomId: string;
  content: string;
  userId: string;
  isAnonymous: boolean;
}

async function sendAnonMessageREST({ roomId, content, userId, isAnonymous }: SendAnonMessageVars) {
  const res = await clerkFetch(
    `/api/anonymousChats/${roomId}/messages/${userId}/${isAnonymous ? 'true' : 'false'}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to send message' }));
    throw new Error(err.error);
  }
  return res.json();
}

export function useAnonymousSendMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendAnonMessageREST,
    onSettled: (data, _err, vars) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: anonChatKeys.messages(vars.roomId) });
      }
    },
  });
}

/* ───── Edit Message ───── */
interface EditAnonMessageVars {
  roomId: string;
  messageId: string;
  content: string;
}

async function editAnonMessageREST({ roomId, messageId, content }: EditAnonMessageVars) {
  const res = await clerkFetch(`/api/anonymousChats/${roomId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to edit message' }));
    throw new Error(err.error);
  }
}

export function useAnonymousEditMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: editAnonMessageREST,
    onSettled: (data, _err, vars) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: anonChatKeys.messages(vars.roomId) });
      }
    },
  });
}

/* ───── Delete Message ───── */
interface DeleteAnonMessageVars {
  roomId: string;
  messageId: string;
}

async function deleteAnonMessageREST({ roomId, messageId }: DeleteAnonMessageVars) {
  const res = await clerkFetch(`/api/anonymousChats/${roomId}/messages/${messageId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete message');
}

export function useAnonymousDeleteMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAnonMessageREST,
    onSettled: (data, _err, vars) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: anonChatKeys.messages(vars.roomId) });
      }
    },
  });
}

/* ───── Vote Message ───── */
interface VoteAnonMessageVars {
  roomId: string;
  messageId: string;
  type: 'upvote' | 'downvote';
}

async function voteAnonMessageREST({ messageId, type }: VoteAnonMessageVars) {
  const res = await clerkFetch(
    `/api/anonymousChats/${messageId}/${type}`,
    { method: 'POST' },
  );
  
  if (!res.ok) throw new Error('Failed to vote');

  return res.json();
}

export function useAnonymousVoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: voteAnonMessageREST,
    onSettled: (data, _err, vars) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: anonChatKeys.messages(vars.roomId) });
      }
    },
  });
}
