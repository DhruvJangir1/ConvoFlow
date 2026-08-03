import type { QueryClient } from '@tanstack/react-query';
import type { Dispatch } from '@reduxjs/toolkit';
import type { HandlerMap } from '../types/WsMessageNotification';
import type { Chat } from '../types/chat';
import { setOnlineUsers, addOnlineUser, removeOnlineUser } from '../store/chatSlice';
import {
  addChatFromWs,
  addMessageToAnonCache,
  addMessageToChatCache,
  addNotificationFromWs,
  removeMessageFromAnonCache,
  removeMessageFromChatCache,
} from '../hooks/wsCacheHandlers';

interface CreateWsHandlersDeps {
  dispatch: Dispatch;
  queryClient: QueryClient;
  currentUserId: string;
  subscribeToChats: (chatIds: string[]) => void;
}

export function createWsHandlers(
  deps: CreateWsHandlersDeps,
): { [K in keyof HandlerMap]: (payload: HandlerMap[K]) => void } {
  const { dispatch, queryClient, currentUserId, subscribeToChats } = deps;

  return {
    'chat:online-users': (payload) => dispatch(setOnlineUsers(payload)),
    'user:online': (payload) => dispatch(addOnlineUser(payload)),
    'user:offline': (payload) => dispatch(removeOnlineUser(payload)),
    'notification:new': (payload) => addNotificationFromWs(queryClient, dispatch, payload),

    'chat:new': (payload) => {
      const chat = payload.chat as Chat;
      addChatFromWs(queryClient, dispatch, chat);
      subscribeToChats([chat.id]);
    },

    'message:new': (payload) => {
      if (payload.chatType === 'anonymous') {
        addMessageToAnonCache(queryClient, payload, currentUserId);
      } else {
        addMessageToChatCache(queryClient, dispatch, payload, currentUserId);
      }
    },

    'message:delete': (payload) => {
      if (payload.isAnonymous) {
        removeMessageFromAnonCache(queryClient, payload.chatId, payload.messageId);
      } else {
        removeMessageFromChatCache(queryClient, payload.chatId, payload.messageId);
      }
    },
  };
}
