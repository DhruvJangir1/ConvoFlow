import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { addChat as addChatRedux } from '../store/chatSlice';
import { chatKeys } from '../lib/queryKeys';
import type { Chat, ChatMessages } from '../types/chat';
import type { MessagesResponse } from './useChatMessagesQuery';
import { clerkFetch } from '../lib/clerkFetch';

/* ───── Send Message ───── */
interface SendMessageVars {
  chatId: string;
  content: string;
  userId: string;
}

async function sendMessageREST({ chatId, content, userId }: SendMessageVars) {
  const res = await clerkFetch(`/api/chats/${chatId}/${userId}/appendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, chatId, userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to send message' }));
    throw new Error(err.error);
  }
  return res.json();
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendMessageREST,
    onSuccess: (data, vars) => {
      queryClient.setQueryData<Chat[]>(chatKeys.lists(), (old) => {
        if (!old) return old;
        return old.map((chat) =>
          chat.id === vars.chatId
            ? { ...chat, lastMessage: vars.content, timestamp: Date.now() }
            : chat,
        );
      });

      if (data?.message) {
        const msg = data.message;
        queryClient.setQueryData<MessagesResponse>(chatKeys.messages(vars.chatId), (old) => {
          const entry: ChatMessages = {
            id: msg.id,
            chatId: vars.chatId,
            senderId: msg.sender_id ?? vars.userId,
            content: msg.content,
            createdAt: msg.created_at ?? new Date().toISOString(),
            isOwn: true,
            senderName: msg.USERS?.user_name ?? '',
            senderImage: msg.USERS?.image_url ?? null,
            isEdited: false,
            messageType: 'text',
          };
          if (!old) return { messages: [entry], hasMore: false };
          if (old.messages.some((m) => m.id === entry.id)) return old;
          return { ...old, messages: [...old.messages, entry] };
        });
      }
    },
  });
}

/* ───── Edit Message ───── */
interface EditMessageVars {
  chatId: string;
  messageId: string;
  content: string;
  userId: string;
}

async function editMessageREST({ chatId, messageId, content, userId }: EditMessageVars) {
  const res = await clerkFetch(`/api/chats/${chatId}/messages/${messageId}/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update message' }));
    throw new Error(err.error);
  }
  return res.json();
}

export function useEditMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: editMessageREST,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(vars.chatId) });
      const prev = queryClient.getQueryData<MessagesResponse>(chatKeys.messages(vars.chatId));
      queryClient.setQueryData<MessagesResponse>(chatKeys.messages(vars.chatId), (old) => {
        if (!old) return old;
        return { ...old, messages: old.messages.map((m) =>
          m.id === vars.messageId ? { ...m, content: vars.content, isEdited: true } : m,
        ) };
      });
      return { prev };
    },
    onError: (_err, vars, context) => {
      const previousMessages = context?.prev;
      if (previousMessages) {
        queryClient.setQueryData(chatKeys.messages(vars.chatId), previousMessages);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
    },
  });
}

/* ───── Delete Message ───── */
interface DeleteMessageVars {
  chatId: string;
  messageId: string;
  userId: string;
}

async function deleteMessageREST({ chatId, messageId, userId }: DeleteMessageVars) {
  const res = await clerkFetch(`/api/chats/${chatId}/messages/${messageId}/${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete message' }));
    throw new Error(err.error);
  }
}

export function useDeleteMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMessageREST,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(vars.chatId) });
      const prev = queryClient.getQueryData<MessagesResponse>(chatKeys.messages(vars.chatId));
      queryClient.setQueryData<MessagesResponse>(chatKeys.messages(vars.chatId), (old) => {
        if (!old) return old;
        return { ...old, messages: old.messages.filter((m) => m.id !== vars.messageId) };
      });
      return { prev };
    },
    onError: (_err, vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(chatKeys.messages(vars.chatId), context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
    },
  });
}

/* ───── Create Chat ───── */
interface CreateChatVars {
  type: string;
  participantIds?: string[];
  name?: string;
}

async function createChatREST(body: CreateChatVars) {
  const res = await clerkFetch('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create chat' }));
    throw new Error(err.error);
  }
  return res.json();
}

export function useCreateChatMutation() {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  return useMutation({
    mutationFn: createChatREST,
    onSuccess: (data) => {
      const newChat: Chat = data.chat ?? data;
      queryClient.setQueryData<Chat[]>(chatKeys.lists(), (old) => {
        if (!old) return [newChat];
        return [newChat, ...old.filter((c) => c.id !== newChat.id)];
      });
      dispatch(addChatRedux(newChat));
    },
  });
}

/* ───── Update Chat in cache (for real-time or manual use) ───── */
export function useUpdateChatsCache() {
  const queryClient = useQueryClient();

  return {
    addChatToCache: (chat: Chat) => {
      queryClient.setQueryData<Chat[]>(chatKeys.lists(), (old) => {
        if (!old) return [chat];
        return [chat, ...old.filter((c) => c.id !== chat.id)];
      });
    },
    updateChatInCache: (chatId: string, updates: Partial<Chat>) => {
      queryClient.setQueryData<Chat[]>(chatKeys.lists(), (old) =>
        old?.map((c) => (c.id === chatId ? { ...c, ...updates } : c)),
      );
    },
    removeChatFromCache: (chatId: string) => {
      queryClient.setQueryData<Chat[]>(chatKeys.lists(), (old) =>
        old?.filter((c) => c.id !== chatId),
      );
    },
  };
}
