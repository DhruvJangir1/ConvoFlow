-- ============================================================================
-- 1. TABLE DECLARATIONS (ORDERED BY DEPENDENCY)
-- ============================================================================

CREATE TABLE PUBLIC."USERS" (
    "id" UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
    "user_name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "image_url" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CLOCK_TIMESTAMP(),
    "last_login" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CLOCK_TIMESTAMP(),
    "refresh_token_hash" TEXT,
    "refresh_token_expiry" TIMESTAMP WITH TIME ZONE,
    "password" TEXT,
    "bio" TEXT,
    "user_tag" TEXT NOT NULL
);

CREATE TABLE PUBLIC."StandardChats" (
    "id" UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
    "type" CHARACTER VARYING NOT NULL DEFAULT 'dm',
    "name" CHARACTER VARYING,
    "avatar_url" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CLOCK_TIMESTAMP(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CLOCK_TIMESTAMP()
);

CREATE TABLE PUBLIC."StandardChatMembers" (
    "chat_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CLOCK_TIMESTAMP(),
    "last_read_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CLOCK_TIMESTAMP()
);

CREATE TABLE PUBLIC."StandardChatMessages" (
    "id" UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
    "chat_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "message_type" CHARACTER VARYING NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "is_edited" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CLOCK_TIMESTAMP(),
    "status" CHARACTER VARYING NOT NULL DEFAULT 'sent'
);

CREATE TABLE PUBLIC."_prisma_migrations" (
    "id" CHARACTER VARYING NOT NULL,
    "checksum" CHARACTER VARYING NOT NULL,
    "finished_at" TIMESTAMP WITH TIME ZONE,
    "migration_name" CHARACTER VARYING NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMP WITH TIME ZONE,
    "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE PUBLIC."AddFriendRequests" (
    "id" UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
    "sender_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "updated_at" TIMESTAMP WITH TIME ZONE,
    "sender_user_tag" TEXT NOT NULL,
    "receiver_user_tag" TEXT NOT NULL
);

CREATE TABLE PUBLIC."Notifications" (
    "id" UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "receiver_user_id" UUID NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "content" TEXT,
    "read_at" TIMESTAMP WITH TIME ZONE,
    "entity_id" UUID NOT NULL
);

CREATE TABLE PUBLIC."AnonymousChats" (
    "id" UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
    "name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE PUBLIC."AnonymousChatMessages" (
    "id" UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "content" TEXT,
    "sendr_id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "message_type" TEXT DEFAULT 'text',
    "is_edited" BOOLEAN DEFAULT FALSE,
    "status" TEXT DEFAULT 'sent'
);

CREATE TABLE PUBLIC."AnonymousChatMembers" (
    "id" UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "is_verified" BOOLEAN DEFAULT FALSE,
    "chat_id" UUID NOT NULL
);

CREATE TABLE PUBLIC."DailyPolls" (
    "id" UUID NOT NULL, -- Removed auto-generation; inherits from AnonymousChats
    "question" TEXT NOT NULL,
    "option1" TEXT NOT NULL,
    "option2" TEXT NOT NULL,
    "option3" TEXT NOT NULL,
    "option4" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "last_voted" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE PUBLIC."UserPollVotes" (
    "id" UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
    "poll_id" UUID,
    "voter_id" UUID,
    "optionSelected" SMALLINT NOT NULL CHECK ("optionSelected" >= 1 AND "optionSelected" <= 4),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. PRIMARY KEYS & UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE PUBLIC."USERS" ADD CONSTRAINT "USERS_pkey" PRIMARY KEY ("id");
ALTER TABLE PUBLIC."StandardChats" ADD CONSTRAINT "StandardChats_pkey" PRIMARY KEY ("id");
ALTER TABLE PUBLIC."StandardChatMembers" ADD CONSTRAINT "StandardChatMembers_pkey" PRIMARY KEY ("chat_id", "user_id");
ALTER TABLE PUBLIC."StandardChatMessages" ADD CONSTRAINT "StandardChatMessages_pkey" PRIMARY KEY ("id");
ALTER TABLE PUBLIC."_prisma_migrations" ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");
ALTER TABLE PUBLIC."AddFriendRequests" ADD CONSTRAINT "AddFriendRequests_pkey" PRIMARY KEY ("id");
ALTER TABLE PUBLIC."Notifications" ADD CONSTRAINT "Notifications_pkey" PRIMARY KEY ("id");
ALTER TABLE PUBLIC."AnonymousChats" ADD CONSTRAINT "AnonymousChats_pkey" PRIMARY KEY ("id");
ALTER TABLE PUBLIC."AnonymousChatMessages" ADD CONSTRAINT "AnonymousChatMessages_pkey" PRIMARY KEY ("id");
ALTER TABLE PUBLIC."AnonymousChatMembers" ADD CONSTRAINT "AnonymousChatMembers_pkey" PRIMARY KEY ("id");
ALTER TABLE PUBLIC."DailyPolls" ADD CONSTRAINT "DailyPolls_pkey" PRIMARY KEY ("id");
ALTER TABLE PUBLIC."UserPollVotes" ADD CONSTRAINT "UserPollVotes_pkey" PRIMARY KEY ("id");

ALTER TABLE PUBLIC."UserPollVotes" ADD CONSTRAINT "unique_voter_per_poll" UNIQUE ("poll_id", "voter_id");

-- ============================================================================
-- 3. FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- AUTH SCHEMA LINK
ALTER TABLE PUBLIC."USERS" ADD CONSTRAINT "USERS_id_fkey" FOREIGN KEY ("id") REFERENCES AUTH.USERS("id") ON DELETE CASCADE;

-- STANDARD CHAT STRATEGY
ALTER TABLE PUBLIC."StandardChats" ADD CONSTRAINT "chats_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES PUBLIC."USERS"("id") ON DELETE SET NULL;
ALTER TABLE PUBLIC."StandardChatMembers" ADD CONSTRAINT "chat_members_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES PUBLIC."StandardChats"("id") ON DELETE CASCADE;
ALTER TABLE PUBLIC."StandardChatMembers" ADD CONSTRAINT "chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES PUBLIC."USERS"("id") ON DELETE CASCADE;
ALTER TABLE PUBLIC."StandardChatMessages" ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES PUBLIC."StandardChats"("id") ON DELETE CASCADE;
ALTER TABLE PUBLIC."StandardChatMessages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES PUBLIC."USERS"("id") ON DELETE CASCADE;

-- FRIEND DISCOVERY SYSTEM
ALTER TABLE PUBLIC."AddFriendRequests" ADD CONSTRAINT "Add_Friend_Requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES PUBLIC."USERS"("id") ON DELETE CASCADE;
ALTER TABLE PUBLIC."AddFriendRequests" ADD CONSTRAINT "Add_Friend_Requests_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES PUBLIC."USERS"("id") ON DELETE CASCADE;

-- NOTIFICATION ENGINE CONSTRAINTS
ALTER TABLE PUBLIC."Notifications" ADD CONSTRAINT "fk_notifications_id_bridge" FOREIGN KEY ("entity_id") REFERENCES PUBLIC."AddFriendRequests"("id") ON DELETE CASCADE;
ALTER TABLE PUBLIC."Notifications" ADD CONSTRAINT "Notifications_receiver_fkey" FOREIGN KEY ("receiver_user_id") REFERENCES PUBLIC."USERS"("id") ON DELETE CASCADE;
ALTER TABLE PUBLIC."Notifications" ADD CONSTRAINT "Notifications_sender_fkey" FOREIGN KEY ("sender_user_id") REFERENCES PUBLIC."USERS"("id") ON DELETE CASCADE;

-- ANONYMOUS CHAT & POLL STRUCTURES
ALTER TABLE PUBLIC."AnonymousChatMessages" ADD CONSTRAINT "fk_anonymous_chat_messages_room" FOREIGN KEY ("chat_id") REFERENCES PUBLIC."AnonymousChats"("id") ON DELETE CASCADE;
ALTER TABLE PUBLIC."AnonymousChatMembers" ADD CONSTRAINT "AnonymousChatMembers_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES PUBLIC."AnonymousChats"("id") ON DELETE CASCADE;
ALTER TABLE PUBLIC."AnonymousChatMembers" ADD CONSTRAINT "fk_anonymous_chat_members_identity" FOREIGN KEY ("id") REFERENCES PUBLIC."USERS"("id") ON DELETE CASCADE;
ALTER TABLE PUBLIC."DailyPolls" ADD CONSTRAINT "DailyPolls_id_fkey" FOREIGN KEY ("id") REFERENCES PUBLIC."AnonymousChats"("id") ON DELETE CASCADE;
ALTER TABLE PUBLIC."DailyPolls" ADD CONSTRAINT "DailyPolls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES PUBLIC."USERS"("id") ON DELETE SET NULL;
ALTER TABLE PUBLIC."UserPollVotes" ADD CONSTRAINT "UserPollVotes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES PUBLIC."DailyPolls"("id") ON DELETE CASCADE;
ALTER TABLE PUBLIC."UserPollVotes" ADD CONSTRAINT "UserPollVotes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES PUBLIC."USERS"("id") ON DELETE CASCADE;

-- ============================================================================
-- 4. READ-OPTIMIZATION INDEXES
-- ============================================================================

CREATE INDEX "idx_standard_messages_chat_id" ON PUBLIC."StandardChatMessages" ("chat_id", "created_at" DESC);
CREATE INDEX "idx_anonymous_messages_chat_id" ON PUBLIC."AnonymousChatMessages" ("chat_id", "created_at" DESC);
CREATE INDEX "idx_poll_votes_ledger" ON PUBLIC."UserPollVotes" ("poll_id", "optionSelected");