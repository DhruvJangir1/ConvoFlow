import type { NotificationPayload } from '../../src/types/WsMessageNotification';

export type SubscribePayload = {
  chatIds: string[];
}

export type MessageSendPayload = {
  chatId: string;
  content: string;
  sentAt: number;
  tempId: string;
}

export type TypingPayload = {
  chatId: string;
}

export type WsClientMessage =
  | { type: 'subscribe'; payload: SubscribePayload }
  | { type: 'unsubscribe'; payload: SubscribePayload }
  | { type: 'message:send'; payload: MessageSendPayload }
  | { type: 'typing:start'; payload: TypingPayload }
  | { type: 'typing:stop'; payload: TypingPayload };

  export type WSMessage =
  | { type: 'message:new'; payload: { id: string; chatId: string; senderId: string; senderName: string; senderImage: string | null; content: string; createdAt: string; messageType: string; isAnonymous: boolean; chatType: string,isEdited:boolean } }
  | { type: 'message:ack'; payload: { id: string; tempId: string } }
  | { type: 'message:delete'; payload: { chatId: string; messageId: string; senderId: string; isAnonymous: boolean } }
  | { type: 'typing:update'; payload: { chatId: string; userId: string; isTyping: boolean } }
  | { type: 'subscribed'; payload: { chatIds: string[] } }
  | { type: 'unsubscribed'; payload: { chatIds: string[] } }
  | { type: 'user:online'; payload: { chatId: string; userId: string } }
  | { type: 'user:offline'; payload: { chatId: string; userId: string } }
  | { type: 'chat:online-users'; payload: { chatId: string; userIds: string[] } }
  | { type: 'notification:new'; payload: NotificationPayload }
  | { type: 'chat:new'; payload: { chat: Record<string, unknown> } }
  | { type: 'error'; payload: { message: string } };

  export type WebSocketContextValue = {
    socket: WebSocket | null;
    send: (type: string, payload: object) => boolean;
    subscribeToChats: (chatIds: string[]) => void;
    onMessage: (handler: (msg: WSMessage) => void) => () => void;
  }