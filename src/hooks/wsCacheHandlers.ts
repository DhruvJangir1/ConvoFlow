import type { QueryClient } from '@tanstack/react-query';
import type { Dispatch } from '@reduxjs/toolkit';
import { chatKeys, anonChatKeys, notifKeys } from '../lib/queryKeys';
import { addChat as addChatRedux, setChats } from '../store/chatSlice';
import { incrementUnreadNotif } from '../store/userAuthSlice';
import type { Chat, ChatMessages, AnonymousChatMessages, Notification } from '../types/chat';
import type { MessagesResponse } from './useChatMessagesQuery';
import type { AnonymousRoom } from './useAnonymousRoomsQuery';

type OrderedMessage = {
  id: string;
  createdAt: string;
};

function insertMessageChronologically<T extends OrderedMessage>(messages: T[], entry: T): T[] {
  const withoutEntry = messages.filter((message) => message.id !== entry.id);
  const entryTime = new Date(entry.createdAt).getTime();
  const insertionIndex = withoutEntry.findIndex((message) => {
    const messageTime = new Date(message.createdAt).getTime();
    return entryTime < messageTime || (entryTime === messageTime && entry.id.localeCompare(message.id) < 0);
  });

  if (insertionIndex === -1) return [...withoutEntry, entry];
  return [...withoutEntry.slice(0, insertionIndex), entry, ...withoutEntry.slice(insertionIndex)];
}

/* ───── Standard Chat: message:new ───── */
interface AddMessageToChatPayload {
  chatId: string;
  id: string;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  content: string;
  createdAt: string;
  isEdited?: boolean;
  messageType?: string;
}

export function addMessageToChatCache(
  queryClient: QueryClient,
  dispatch: Dispatch,
  payload: AddMessageToChatPayload,
  currentUserId: string,
): void {
  const { chatId, ...rest } = payload;
  const current = queryClient.getQueryData<MessagesResponse>(chatKeys.messages(chatId));
  if (current) {
    queryClient.setQueryData<MessagesResponse>(chatKeys.messages(chatId), (old) => {
      if (!old) return old;
      const entry: ChatMessages = {
        id: rest.id,
        chatId,
        senderId: rest.senderId,
        senderName: rest.senderName,
        senderImage: rest.senderImage ?? null,
        content: rest.content,
        createdAt: rest.createdAt,
        isOwn: rest.senderId === currentUserId,
        isEdited: rest.isEdited ?? false,
        messageType: rest.messageType ?? 'text',
      };
      if (old.messages.some((m) => m.id === entry.id)) return old;
      return { ...old, messages: insertMessageChronologically(old.messages, entry) };
    });
  }

  const timestamp = new Date(rest.createdAt).getTime();
  const oldChats = queryClient.getQueryData<Chat[]>(chatKeys.lists());
  const wasFirst = oldChats !== undefined && oldChats.length > 0 && oldChats[0].id === chatId;

  const updatedChats = queryClient.setQueryData<Chat[]>(chatKeys.lists(), (old) => {
    if (!old) return old;
    const updated = old.map((chat) =>
      chat.id === chatId
        ? { ...chat, lastMessage: rest.content, timestamp }
        : chat,
    );
    return [...updated].sort((a, b) => b.timestamp - a.timestamp);
  });
  if (updatedChats && !wasFirst) {
    dispatch(setChats(updatedChats));
  }
}

/* ───── Standard Chat: message:delete ───── */
export function removeMessageFromChatCache(
  queryClient: QueryClient,
  chatId: string,
  messageId: string,
): void {
  queryClient.setQueryData<MessagesResponse>(chatKeys.messages(chatId), (old) => {
    if (!old) return old;
    return { ...old, messages: old.messages.filter((m) => m.id !== messageId) };
  });
}

/* ───── Standard Chat: chat:new ───── */
export function addChatFromWs(
  queryClient: QueryClient,
  dispatch: Dispatch,
  chat: Chat,
): void {
  dispatch(addChatRedux(chat));
  queryClient.setQueryData<Chat[]>(chatKeys.lists(), (old) =>
    old ? [chat, ...old.filter((c) => c.id !== chat.id)] : [chat],
  );
}

/* ───── Anonymous Chat: message:new ───── */
interface AddMessageToAnonPayload {
  chatId: string;
  id: string;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  content: string;
  createdAt: string;
  messageType?: string;
  isAnonymous: boolean;
}

export function addMessageToAnonCache(
  queryClient: QueryClient,
  payload: AddMessageToAnonPayload,
  currentUserId: string,
): void {
  const { chatId, ...rest } = payload;
  const isAnon = rest.isAnonymous;

  const current = queryClient.getQueryData<{ messages: AnonymousChatMessages[]; hasMore: boolean }>(anonChatKeys.messages(chatId));
  if (current) {
    queryClient.setQueryData<{ messages: AnonymousChatMessages[]; hasMore: boolean }>(anonChatKeys.messages(chatId), (old) => {
      if (!old) return old;
      if (old.messages.some((m) => m.id === rest.id)) return old;
      const entry: AnonymousChatMessages = {
        id: rest.id,
        chatId,
        senderId: rest.senderId,
        senderName: isAnon ? 'Anonymous' : rest.senderName,
        senderImage: isAnon ? null : rest.senderImage,
        content: rest.content,
        createdAt: rest.createdAt,
        isOwn: rest.senderId === currentUserId,
        isEdited: false,
        messageType: rest.messageType ?? 'text',
        totalUpvotes: 0,
        userVote: null,
        isAnonymous: isAnon,
      };
      return { ...old, messages: insertMessageChronologically(old.messages, entry) };
    });
  }

  const timestamp = new Date(rest.createdAt).getTime();
  queryClient.setQueryData<AnonymousRoom[]>(anonChatKeys.lists(), (old) => {
    if (!old) return old;
    const updated = old.map((room) =>
      room.id === chatId
        ? { ...room, lastMessage: rest.content, timestamp }
        : room,
    );
    return [...updated].sort((a, b) => b.timestamp - a.timestamp);
  });
}

/* ───── Anonymous Chat: message:delete ───── */
export function removeMessageFromAnonCache(
  queryClient: QueryClient,
  chatId: string,
  messageId: string,
): void {
  queryClient.setQueryData<{ messages: AnonymousChatMessages[]; hasMore: boolean }>(anonChatKeys.messages(chatId), (old) => {
    if (!old) return old;
    return { ...old, messages: old.messages.filter((m) => m.id !== messageId) };
  });
}

/* ───── Notification: notification:new ───── */
export function addNotificationFromWs(
  queryClient: QueryClient,
  dispatch: Dispatch,
  notification: Notification,
): void {
  dispatch(incrementUnreadNotif());
  queryClient.setQueryData<Notification[]>(notifKeys.lists(), (old) =>
    old ? [notification, ...old.filter((n) => n.id !== notification.id)] : [notification],
  );
}
