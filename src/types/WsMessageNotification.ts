import type { WSMessage } from "../../backend/ws/wsTypes";
export interface NotificationPayload {
  id: string;
  receiver_user_id: string;
  sender_user_id: string;
  type: string;
  content: string | null;
  entity_id: string;
  read_at: string | null;
  created_at: string;
}

export type MessageNewPayload = Extract<WSMessage, { type: 'message:new' }>['payload'] & { isEdited: boolean };

     export type HandlerMap = {
        'chat:online-users': Extract<WSMessage, { type: 'chat:online-users' }>['payload'];
        'user:online': Extract<WSMessage, { type: 'user:online' }>['payload'];
        'user:offline': Extract<WSMessage, { type: 'user:offline' }>['payload'];
        'notification:new': Extract<WSMessage, { type: 'notification:new' }>['payload'];
        'chat:new': Extract<WSMessage, { type: 'chat:new' }>['payload'];
        'message:new': MessageNewPayload;
        'message:delete': Extract<WSMessage, { type: 'message:delete' }>['payload'];
      };