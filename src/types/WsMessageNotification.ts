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
