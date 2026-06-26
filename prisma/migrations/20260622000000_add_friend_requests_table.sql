-- CreateTable
CREATE TABLE "USERS" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "image_url" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "last_login" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "refresh_token_hash" TEXT,
    "refresh_token_expiry" TIMESTAMPTZ(6),
    "password" TEXT,
    "user_tag" TEXT NOT NULL

    CONSTRAINT "USERS_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_members" (
    "chat_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "last_read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "chat_members_pkey" PRIMARY KEY ("chat_id","user_id")
);

CREATE TABLE "chats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" VARCHAR(50) NOT NULL DEFAULT 'dm',
    "name" VARCHAR(255),
    "avatar_url" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chat_id" UUID NOT NULL,
    "sender_id" UUID,
    "message_type" VARCHAR(15) NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "status" VARCHAR(20) NOT NULL DEFAULT 'sent',

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Add_Friend_Requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sender_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "updated_at" TIMESTAMPTZ(6),
    "sender_user_tag" TEXT NOT NULL,
    "receiver_user_tag" TEXT NOT NULL,

    CONSTRAINT "Add_Friend_Requests_pkey" PRIMARY KEY ("id")
);


-- CreateIndexes
CREATE UNIQUE INDEX "USERS_user_name_key" ON "USERS"("user_name");

CREATE UNIQUE INDEX "USERS_email_key" ON "USERS"("email");

CREATE INDEX "idx_chat_members_user_lookup" ON "chat_members"("user_id", "chat_id", "last_read_at");

CREATE INDEX "idx_messages_stream_perf" ON "messages"("chat_id", "created_at" DESC, "sender_id", "message_type", "content", "is_edited", "status");

-- AddForeignKeys
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USERS"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "chats" ADD CONSTRAINT "chats_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "USERS"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "USERS"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "Add_Friend_Requests" ADD CONSTRAINT "Add_Friend_Requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "USERS"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "Add_Friend_Requests" ADD CONSTRAINT "Add_Friend_Requests_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "USERS"("id") ON DELETE CASCADE ON UPDATE NO ACTION;