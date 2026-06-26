import { useRef, useEffect, useLayoutEffect, useMemo, useCallback, useState } from "react";
import { IconButton } from "@mui/material";
import Edit from "@mui/icons-material/Edit";
import Delete from "@mui/icons-material/Delete";
import Check from "@mui/icons-material/Check";
import Close from "@mui/icons-material/Close";
import { SmilePlus } from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import type { ChatMessages as Message, Reaction } from "../types/chat";

type MessageListProps = {
  messages: Message[];
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  streaming?: boolean;
  editingMessageId: string | null;
  editText: string;
  onEditTextChange: (val: string) => void;
  onStartEdit: (msgId: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDeleteClick: (msgId: string) => void;
  userId: string;
  onAddReaction: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, reactionId: string) => void;
};

type Group = {
  senderId: string;
  isOwn: boolean;
  messages: Message[];
};

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function within5Min(a: string, b: string): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 300000;
}

function groupMessages(messages: Message[]): { groups: Group[]; dates: string[] } {
  const groups: Group[] = [];
  const dates: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (i === 0) {
      dates.push(msg.createdAt);
      groups.push({ senderId: msg.senderId, isOwn: msg.isOwn, messages: [msg] });
      continue;
    }
    const prev = messages[i - 1];
    if (msg.senderId === prev.senderId && within5Min(prev.createdAt, msg.createdAt)) {
      groups[groups.length - 1].messages.push(msg);
    } else {
      groups.push({ senderId: msg.senderId, isOwn: msg.isOwn, messages: [msg] });
    }
    if (!sameDay(prev.createdAt, msg.createdAt)) {
      dates.push(msg.createdAt);
    }
  }
  return { groups, dates };
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((todayStart.getTime() - dateStart.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function wrapText(text: string, maxChars: number = 75): string {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    parts.push(text.slice(i, i + maxChars));
  }
  return parts.join("\n");
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-text-secondary"
          style={{ animation: `typing-dot 600ms ease-in-out ${i * 150}ms infinite` }}
        />
      ))}
    </div>
  );
}

type GroupedReactions = {
  emoji: string;
  count: number;
  userReacted: boolean;
  reactionIds: string[];
};

function groupReactions(reactions: Reaction[] | undefined, userId: string): GroupedReactions[] {
  if (!reactions || reactions.length === 0) return [];
  const map = new Map<string, { count: number; userReacted: boolean; ids: string[] }>();
  for (const r of reactions) {
    const entry = map.get(r.emoji);
    if (entry) {
      entry.count++;
      if (r.userId === userId) entry.userReacted = true;
      entry.ids.push(r.id);
    } else {
      map.set(r.emoji, { count: 1, userReacted: r.userId === userId, ids: [r.id] });
    }
  }
  return Array.from(map.entries()).map(([emoji, val]) => ({
    emoji,
    count: val.count,
    userReacted: val.userReacted,
    reactionIds: val.ids,
  }));
}

function ReactionBar({
  reactions,
  userId,
  onAddReaction,
  onRemoveReaction,
  messageId,
}: {
  reactions: Reaction[] | undefined;
  userId: string;
  onAddReaction: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, reactionId: string) => void;
  messageId: string;
}) {
  const grouped = groupReactions(reactions, userId);
  if (grouped.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {grouped.map((g) => (
        <button
          key={g.emoji}
          onClick={() => {
            if (g.userReacted) {
              onRemoveReaction(messageId, g.reactionIds[0]);
            } else {
              onAddReaction(messageId, g.emoji);
            }
          }}
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs transition-colors ${
            g.userReacted
              ? "border-indigo-500/40 bg-indigo-600/30 text-indigo-200"
              : "border-zinc-700/50 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/60"
          }`}
        >
          <span className="text-sm leading-none">{g.emoji}</span>
          <span className="leading-none">{g.count}</span>
        </button>
      ))}
    </div>
  );
}

function EmojiPickerPopover({
  open,
  onClose,
  onEmojiSelect,
  anchorRef,
  alignRight,
}: {
  open: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  alignRight?: boolean;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [openUpward, setOpenUpward] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setOpenUpward(rect.top > window.innerHeight * 0.5);
    }
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      className={`absolute z-50 animate-modal-in ${openUpward ? "bottom-full mb-2" : "top-full mt-2"} ${alignRight ? "right-0" : "left-0"}`}
    >
      <div className="overflow-hidden rounded-xl border border-zinc-700/50 bg-[#1c1c1f] shadow-xl shadow-black/40">
          <Picker
            data={data}
            onEmojiSelect={(emoji: { native: string }) => {
              onEmojiSelect(emoji.native);
              onClose();
            }}
            theme="dark"
            previewPosition="none"
            skinTonePosition="none"
            set="native"
            perLine={7}
            emojiSize={22}
            maxFrequentRows={2}
          />
      </div>
    </div>
  );
}

export default function MessageList({
  messages,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  streaming,
  editingMessageId,
  editText,
  onEditTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDeleteClick,
  userId,
  onAddReaction,
  onRemoveReaction,
}: MessageListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const prevScrollInfo = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const isPrependingRef = useRef(false);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const emojiButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const { groups } = useMemo(() => groupMessages(messages), [messages]);

  const handleEmojiPickerClose = useCallback(() => setEmojiPickerMsgId(null), []);

  const handleEmojiSelect = useCallback(
    (messageId: string, emoji: string) => {
      onAddReaction(messageId, emoji);
    },
    [onAddReaction],
  );

  const setEmojiButtonRef = useCallback((msgId: string, el: HTMLButtonElement | null) => {
    if (el) {
      emojiButtonRefs.current.set(msgId, el);
    } else {
      emojiButtonRefs.current.delete(msgId);
    }
  }, []);

  useEffect(() => {
    const el = editTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [editText]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent, onSave: () => void, onCancel: () => void) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [],
  );

  const prevLengthRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevLengthRef.current && !isPrependingRef.current) {
      sentinelRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    isPrependingRef.current = false;
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    if (!loading) {
      sentinelRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
    }
  }, [loading]);

  const handleLoadMore = useCallback(() => {
    if (!onLoadMore || !hasMore || loadingMore) return;
    isPrependingRef.current = true;
    if (listRef.current) {
      prevScrollInfo.current = {
        scrollHeight: listRef.current.scrollHeight,
        scrollTop: listRef.current.scrollTop,
      };
    }
    onLoadMore();
  }, [onLoadMore, hasMore, loadingMore]);

  useLayoutEffect(() => {
    if (!loadingMore && prevScrollInfo.current && listRef.current) {
      const { scrollHeight: oldHeight, scrollTop: oldTop } = prevScrollInfo.current;
      const newHeight = listRef.current.scrollHeight;
      listRef.current.scrollTop = newHeight - oldHeight + oldTop;
      prevScrollInfo.current = null;
    }
  }, [loadingMore]);

  useEffect(() => {
    const el = topSentinelRef.current;
    if (!el || !onLoadMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: "100px 0px 0px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleLoadMore, onLoadMore]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface">
        <div className="flex items-center gap-2 text-text-muted">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-text-muted"
                style={{ animation: `typing-dot 600ms ease-in-out ${i * 150}ms infinite` }}
              />
            ))}
          </div>
          <span className="text-xs">Loading messages</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface">
        <p className="text-sm text-text-muted">No messages yet. Start a conversation!</p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      className="chat-scrollbar flex min-h-0 flex-1 flex-col overflow-y-scroll overflow-x-hidden bg-surface w-full"
    >
      <div className="flex flex-col px-4">
        <div ref={topSentinelRef} className="flex items-center justify-center py-2">
          {loadingMore && (
            <div className="flex items-center gap-2 text-text-muted">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-text-muted"
                    style={{ animation: `typing-dot 600ms ease-in-out ${i * 150}ms infinite` }}
                  />
                ))}
              </div>
              <span className="text-xs">Loading older messages</span>
            </div>
          )}
          {!loadingMore && !hasMore && messages.length > 0 && (
            <span className="text-xs text-text-muted">No more messages</span>
          )}
        </div>
        {groups.map((group, gi) => {
          const showDate = gi === 0 || !sameDay(
            groups[gi - 1].messages[groups[gi - 1].messages.length - 1].createdAt,
            group.messages[0].createdAt,
          );

          return (
            <div key={group.messages[0].id}>
              {showDate && (
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-zinc-800/50" />
                  <span className="text-xs tracking-wider text-zinc-500 uppercase shrink-0">
                    {formatDateSeparator(group.messages[0].createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-zinc-800/50" />
                </div>
              )}

              {group.messages.map((msg, mi) => {
                const isLast = mi === group.messages.length - 1;
                const isEditing = editingMessageId === String(msg.id);
                const pickerOpen = emojiPickerMsgId === msg.id;

                return (
                  <div
                    key={`${group.messages[0].id}-${mi}`}
                    className={`group flex w-full animate-message-in ${isLast ? "mb-3" : "mb-0.5"}`}
                    style={{
                      justifyContent: group.isOwn ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      className={`flex flex-col w-full max-w-[70%] ${
                        group.isOwn ? "items-end" : "items-start"
                      }`}
                    >
                      {mi === 0 && !group.isOwn && (
                        <span className="mb-1 ml-0.5 text-[12px] font-semibold text-accent-secondary">
                          {msg.senderName}
                        </span>
                      )}
                      <div
                        className={`transition-all duration-200 ${
                          isEditing
                            ? "rounded-2xl border border-border bg-surface-raised shadow-lg shadow-black/20 px-3.5 pt-3 pb-2"
                            : group.isOwn
                              ? "w-fit rounded-2xl rounded-tr-sm bg-indigo-600 text-white shadow-sm px-3 py-1.5"
                              : "w-fit rounded-2xl rounded-tl-sm bg-zinc-800 text-text-primary shadow-sm px-3 py-1.5"
                        }`}
                        style={{ maxWidth: "100%" }}
                      >
                        {isEditing ? (
                          <div
                            style={{
                              animation: "edit-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                            }}
                          >
                            <textarea
                              ref={editTextareaRef}
                              value={editText}
                              onChange={(e) => onEditTextChange(e.target.value)}
                              onKeyDown={(e) => handleEditKeyDown(e, onSaveEdit, onCancelEdit)}
                              autoFocus
                              rows={1}
                              placeholder="Edit message..."
                              aria-label="Edit message"
                              className="w-full resize-none bg-transparent text-[15px]/[1.6] text-text-primary placeholder-text-muted outline-none"
                              style={{ maxHeight: "200px" }}
                            />
                            <div className="flex items-center justify-end gap-1.5 mt-2.5">
                              <button
                                type="button"
                                onClick={onCancelEdit}
                                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium text-text-muted transition-all duration-150 hover:bg-surface-hover hover:text-text-secondary active:scale-95"
                              >
                                <Close sx={{ fontSize: 14 }} />
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={onSaveEdit}
                                disabled={!editText.trim()}
                                className={`flex items-center gap-1 rounded-lg px-3 py-1 text-[12px] font-medium transition-all duration-150 active:scale-95 disabled:opacity-40 ${
                                  editText.trim()
                                    ? "bg-accent text-white hover:bg-accent-hover"
                                    : "bg-border text-text-muted"
                                }`}
                              >
                                <Check sx={{ fontSize: 14 }} />
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm whitespace-pre-wrap min-w-0">
                              {wrapText(msg.content)}
                            </p>
                            <ReactionBar
                              reactions={msg.reactions}
                              userId={userId}
                              onAddReaction={onAddReaction}
                              onRemoveReaction={onRemoveReaction}
                              messageId={msg.id}
                            />
                            {isLast && (
                              <div className={`flex ${group.isOwn ? "justify-end" : "justify-start"} mt-0.5`}>
                                <span className={`text-[10px] select-none whitespace-nowrap ${
                                  group.isOwn ? "text-indigo-200/80" : "text-zinc-400/80"
                                }`}>
                                  {formatMessageTime(msg.createdAt)}
                                  {msg.isEdited && (
                                    <span className="ml-0.5 opacity-60">(edited)</span>
                                  )}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 relative">
                          <button
                            ref={(el) => setEmojiButtonRef(msg.id, el)}
                            onClick={() =>
                              setEmojiPickerMsgId((prev) =>
                                prev === msg.id ? null : msg.id,
                              )
                            }
                            className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                            aria-label="Add reaction"
                          >
                            <SmilePlus className="h-3.5 w-3.5" />
                          </button>
                          <EmojiPickerPopover
                            open={pickerOpen}
                            onClose={handleEmojiPickerClose}
                            onEmojiSelect={(emoji) => handleEmojiSelect(msg.id, emoji)}
                            anchorRef={{
                              current: emojiButtonRefs.current.get(msg.id) ?? null,
                            }}
                            alignRight={group.isOwn}
                          />
                          {group.isOwn && (
                            <>
                              <IconButton
                                size="small"
                                onClick={() => onStartEdit(String(msg.id))}
                                sx={{ color: '#8A8AA0', padding: '4px' }}
                              >
                                <Edit sx={{ fontSize: 14 }} />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => onDeleteClick(String(msg.id))}
                                sx={{ color: '#8A8AA0', padding: '4px' }}
                              >
                                <Delete sx={{ fontSize: 14 }} />
                              </IconButton>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            </div>
          );
        })}

        {streaming && (
          <div className="mb-3 flex w-full items-start justify-start">
            <div className="flex flex-col items-start">
              <div className="w-fit rounded-2xl rounded-tl-sm bg-zinc-800 px-3 py-1.5 text-text-primary">
                <TypingDots />
              </div>
            </div>
          </div>
        )}

        <div ref={sentinelRef} className="h-px" />
      </div>
    </div>
  );
}
