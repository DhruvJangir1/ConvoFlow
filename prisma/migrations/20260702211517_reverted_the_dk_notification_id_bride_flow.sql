-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.USERS (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_name text NOT NULL,
  email text NOT NULL UNIQUE,
  image_url text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  last_login timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  refresh_token_hash text,
  refresh_token_expiry timestamp with time zone,
  password text,
  bio text,
  user_tag text NOT NULL,
  role text NOT NULL DEFAULT 'user'::text,
  CONSTRAINT USERS_pkey PRIMARY KEY (id),
  CONSTRAINT USERS_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.StandardChats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type character varying NOT NULL DEFAULT 'dm'::character varying,
  name character varying,
  avatar_url text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT StandardChats_pkey PRIMARY KEY (id),
  CONSTRAINT chats_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.USERS(id)
);
CREATE TABLE public.StandardChatMembers (
  chat_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  last_read_at timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT StandardChatMembers_pkey PRIMARY KEY (chat_id, user_id),
  CONSTRAINT chat_members_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.StandardChats(id),
  CONSTRAINT chat_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.USERS(id)
);
CREATE TABLE public.StandardChatMessages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  message_type character varying NOT NULL DEFAULT 'text'::character varying,
  content text NOT NULL,
  is_edited boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  status character varying NOT NULL DEFAULT 'sent'::character varying,
  CONSTRAINT StandardChatMessages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.StandardChats(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.USERS(id)
);
CREATE TABLE public._prisma_migrations (
  id character varying NOT NULL,
  checksum character varying NOT NULL,
  finished_at timestamp with time zone,
  migration_name character varying NOT NULL,
  logs text,
  rolled_back_at timestamp with time zone,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  applied_steps_count integer NOT NULL DEFAULT 0,
  CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.AddFriendRequests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'::text,
  updated_at timestamp with time zone,
  sender_user_tag text NOT NULL,
  receiver_user_tag text NOT NULL,
  CONSTRAINT AddFriendRequests_pkey PRIMARY KEY (id),
  CONSTRAINT Add_Friend_Requests_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.USERS(id),
  CONSTRAINT Add_Friend_Requests_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.USERS(id),
  CONSTRAINT fk_notifications_id_bridge FOREIGN KEY (id) REFERENCES public.Notifications(entity_id)
);
CREATE TABLE public.Notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  receiver_user_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  type text NOT NULL DEFAULT ''::text,
  content text,
  read_at timestamp with time zone,
  entity_id uuid NOT NULL UNIQUE,
  CONSTRAINT Notifications_pkey PRIMARY KEY (id),
  CONSTRAINT Notifications_receiver_fkey FOREIGN KEY (receiver_user_id) REFERENCES public.USERS(id),
  CONSTRAINT Notifications_sender_fkey FOREIGN KEY (sender_user_id) REFERENCES public.USERS(id)
);
CREATE TABLE public.AnonymousChats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT AnonymousChats_pkey PRIMARY KEY (id)
);
CREATE TABLE public.AnonymousChatMessages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  content text,
  chat_id uuid NOT NULL,
  message_type text NOT NULL DEFAULT 'text'::text,
  is_edited boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'sent'::text,
  sender_id uuid,
  TotalUpvotes smallint NOT NULL DEFAULT '0'::smallint,
  lastVoted timestamp with time zone,
  isAnonymous boolean NOT NULL DEFAULT false,
  CONSTRAINT AnonymousChatMessages_pkey PRIMARY KEY (id),
  CONSTRAINT fk_anonymous_chat_messages_room FOREIGN KEY (chat_id) REFERENCES public.AnonymousChats(id)
);
CREATE TABLE public.AnonymousChatMembers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  chat_id uuid NOT NULL,
  CONSTRAINT AnonymousChatMembers_pkey PRIMARY KEY (id),
  CONSTRAINT AnonymousChatMembers_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.AnonymousChats(id),
  CONSTRAINT fk_anonymous_chat_members_identity FOREIGN KEY (id) REFERENCES public.USERS(id)
);
CREATE TABLE public.DailyPolls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question text NOT NULL,
  option1 text NOT NULL,
  option2 text NOT NULL,
  option3 text NOT NULL,
  option4 text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  last_voted timestamp with time zone,
  CONSTRAINT DailyPolls_pkey PRIMARY KEY (id),
  CONSTRAINT DailyPolls_id_fkey FOREIGN KEY (id) REFERENCES public.AnonymousChats(id),
  CONSTRAINT DailyPolls_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.USERS(id)
);
CREATE TABLE public.UserPollVotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  poll_id uuid,
  voter_id uuid,
  optionSelected smallint NOT NULL CHECK ("optionSelected" >= 1 AND "optionSelected" <= 4),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT UserPollVotes_pkey PRIMARY KEY (id),
  CONSTRAINT UserPollVotes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.DailyPolls(id),
  CONSTRAINT UserPollVotes_voter_id_fkey FOREIGN KEY (voter_id) REFERENCES public.USERS(id)
);
CREATE TABLE public.AnonymousChatMessagesUserVotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mesage_id uuid NOT NULL,
  type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT AnonymousChatMessagesUserVotes_pkey PRIMARY KEY (id)
);