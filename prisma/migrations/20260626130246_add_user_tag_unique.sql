-- Backfill: assign tags to any users that don't have a properly formatted one
-- Run prisma/backfillUserTags.js before this migration if you have existing users.

-- Add unique constraint on user_tag
CREATE UNIQUE INDEX "USERS_user_tag_key" ON "USERS"("user_tag");
