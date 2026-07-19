export type NotificationPayload ={
  id: string;
  created_at: string;
  receiver_user_id: string;
  sender_user_id: string;
  type: string;
  content: string | null;
  read_at: string | null;
  entity_id: string;
}

export type WSMessage =
  { type: 'message:new'; payload: {
    isAnonymous: boolean; id: string; chatId: string; senderId: string; senderName: string; senderImage: string | null; content: string; createdAt: string; messageType?: string 
}}
  | { type: 'message:ack'; payload: { id: string; tempId?: string } }
  | { type: 'typing:update'; payload: { chatId: string; userId: string; isTyping: boolean } }
  | { type: 'subscribed'; payload: { chatIds: string[] } }
  | { type: 'unsubscribed'; payload: { chatIds: string[] } }
  | { type: 'user:online'; payload: { chatId: string; userId: string } }
  | { type: 'user:offline'; payload: { chatId: string; userId: string } }
  | { type: 'chat:online-users'; payload: { chatId: string; userIds: string[] } }
  | { type: 'notification:new'; payload: NotificationPayload }
  | { type: 'chat:new'; payload: { chat: { id: string; name: string; avatar_url: string | null; lastMessage: string; timestamp: number; unread: number; type: string; messageCount: number; members: { id: string; user_name: string; image_url: string | null }[] } } }
  | { type: 'message:delete'; payload: { chatId: string; messageId: string; senderId: string; isAnonymous: boolean } }
  | { type: 'error'; payload: { message: string } };
  