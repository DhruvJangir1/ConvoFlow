-- Change AnonymousChatMembers primary key from single-column (id) to composite (id, chat_id)
--
-- The previous primary key on "id" (= user id) limited a user to a single
-- AnonymousChatMembers row, which in turn limited WebSocket subscription to
-- one anonymous room. This matches schema.prisma's @@id([id, chat_id]).
--
-- Existing rows are safe: "id" was unique, so every (id, chat_id) pair is
-- already distinct and no dedup is required before adding the composite key.

ALTER TABLE "AnonymousChatMembers" DROP CONSTRAINT "AnonymousChatMembers_pkey";

ALTER TABLE "AnonymousChatMembers" ADD CONSTRAINT "AnonymousChatMembers_pkey" PRIMARY KEY ("id", "chat_id");

-- Rollback (if needed):
-- ALTER TABLE "AnonymousChatMembers" DROP CONSTRAINT "AnonymousChatMembers_pkey";
-- ALTER TABLE "AnonymousChatMembers" ADD CONSTRAINT "AnonymousChatMembers_pkey" PRIMARY KEY ("id");
