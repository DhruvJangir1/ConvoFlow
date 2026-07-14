export type ChatMember = {
  id: string;
  user_name: string;
  image_url: string | null;
};

export type Chat = {
  id: string;
  name: string;
  avatar_url: string | null;
  lastMessage: string;
  timestamp: number;
  unread: number;
  type: string;
  messageCount: number;
  members: ChatMember[];
};

export type Reaction = {
  id: string;
  userId: string;
  userName: string;
  emoji: string;
  createdAt: string;
};

export type ChatMessages = {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: string;
  isOwn: boolean;
  senderName: string;
  senderImage: null | string;
  isEdited: boolean;
  messageType: string;
  reactions?: Reaction[];
};

export type AnonymousChatMessages = ChatMessages & {
  totalUpvotes: number;
  userVote: 'upvote' | 'downvote' | null;
  isAnonymous: boolean;
};

export interface Notification {
  id: string;
  created_at: string;
  receiver_user_id: string;
  sender_user_id: string;
  type: string;
  content: string | null;
  read_at: string | null;
  entity_id: string;
}

