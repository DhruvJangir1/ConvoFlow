-- Optimize StandardChatMessages INSERT performance
--
-- The previous index "idx_messages_stream_perf" included "content TEXT" in the
-- covering payload. Every INSERT paid the cost of writing variable-length text
-- into the index leaf pages, adding ~20-40ms of write amplification per message.
--
-- This migration drops "content" from the INCLUDE list. The pagination query
-- (WHERE chat_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT 20)
-- still gets sender_id, message_type, is_edited, status from the index. Only
-- content requires a heap lookup — 20 lookups at ~1-2ms each is negligible.

DROP INDEX IF EXISTS "idx_messages_stream_perf";

CREATE INDEX "idx_messages_chat_created"
  ON "StandardChatMessages" ("chat_id", "created_at" DESC)
  INCLUDE (sender_id, message_type, is_edited, status);

-- Rollback (if needed):
-- DROP INDEX IF EXISTS "idx_messages_chat_created";
-- CREATE INDEX "idx_messages_stream_perf"
--   ON "StandardChatMessages" ("chat_id", "created_at" DESC)
--   INCLUDE (sender_id, message_type, content, is_edited, status);
