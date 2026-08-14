import { useRef, useEffect, useMemo, useCallback } from "react";
import { CheckCheck } from "lucide-react";
import type { ChatMessages, AnonymousChatMessages } from "../types/chat";
import UserAvatar from "./UserAvatar";
import AnonymousUserAvatar from "./AnonymousUserAvatar";

/* ───── Types ───── */

type Message = ChatMessages | AnonymousChatMessages;

function isAnon(msg: Message): msg is AnonymousChatMessages {
  return 'isAnonymous' in msg && msg.isAnonymous === true;
}

type AnonymousMessageFeedProps = {
  messages: Message[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  streaming: boolean;
  editingMessageId: string | null;
  editText: string;
  onEditTextChange: (val: string) => void;
  onStartEdit: (msgId: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDeleteClick: (msgId: string) => void;
  onImageClick?: (url: string) => void;
};

/* ───── Helpers ───── */

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

function getAvatarColors(id: string): [string, string] {
  const colors = ["#6366f1","#8b5cf6","#a855f7","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899"];
  const i = hashStr(id) % colors.length;
  const j = (i + 3) % colors.length;
  return [colors[i], colors[j]];
}

function fmtTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function within5Min(a: string, b: string): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 300000;
}

function isImgUrl(v: string): boolean {
  if (!v) return false;
  try { return Boolean(new URL(v).pathname.match(/\.(jpe?g|png|gif|webp|avif|svg|bmp)(\?.*)?$/i)); }
  catch { return false; }
}

function fmtDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

/* ───── Message Grouping ───── */

type Group = { senderId: string; isOwn: boolean; messages: Message[] };

function groupMessages(msgs: Message[]): { groups: Group[]; dates: string[] } {
  const groups: Group[] = [];
  const dates: string[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    if (i === 0) { dates.push(msg.createdAt); groups.push({ senderId: msg.senderId, isOwn: msg.isOwn, messages: [msg] }); continue; }
    const prev = msgs[i - 1];
    if (msg.senderId === prev.senderId && within5Min(prev.createdAt, msg.createdAt)) {
      groups[groups.length - 1].messages.push(msg);
    } else {
      groups.push({ senderId: msg.senderId, isOwn: msg.isOwn, messages: [msg] });
    }
    if (!isSameDay(prev.createdAt, msg.createdAt)) dates.push(msg.createdAt);
  }
  return { groups, dates };
}

/* ───── Typing Dots ───── */

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-text-muted)", animation: `dot-b 800ms ease-in-out ${i * 200}ms infinite` }} />
      ))}
    </div>
  );
}

/* ───── Main Component ───── */

export default function AnonymousMessageFeed({
  messages, loading, loadingMore, hasMore, onLoadMore, streaming,
  editingMessageId, editText, onEditTextChange, onStartEdit, onSaveEdit, onCancelEdit,
  onDeleteClick, onImageClick,
}: AnonymousMessageFeedProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const prevScrollInfo = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const isPrepending = useRef(false);

  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { groups } = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    const el = editTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [editText]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent, save: () => void, cancel: () => void) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
      else if (e.key === "Escape") { e.preventDefault(); cancel(); }
    }, []);

  const prevLenRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevLenRef.current && !isPrepending.current && sentinelRef.current)
      sentinelRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    isPrepending.current = false;
    prevLenRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    if (!loading && sentinelRef.current) sentinelRef.current.scrollIntoView({ behavior: "instant", block: "end" });
  }, [loading]);

  const handleLoadMore = useCallback(() => {
    if (!onLoadMore || !hasMore || loadingMore) return;
    isPrepending.current = true;
    if (listRef.current) prevScrollInfo.current = { scrollHeight: listRef.current.scrollHeight, scrollTop: listRef.current.scrollTop };
    onLoadMore();
  }, [onLoadMore, hasMore, loadingMore]);

  useEffect(() => {
    if (!loadingMore && prevScrollInfo.current && listRef.current) {
      const { scrollHeight: oldH, scrollTop: oldT } = prevScrollInfo.current;
      listRef.current.scrollTop = listRef.current.scrollHeight - oldH + oldT;
      prevScrollInfo.current = null;
    }
  }, [loadingMore]);

  useEffect(() => {
    const el = topSentinelRef.current;
    if (!el || !onLoadMore) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) handleLoadMore(); }, { rootMargin: "100px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [handleLoadMore, onLoadMore]);

  /* ── Loading ── */
  if (loading) return (
    <div className="flex flex-1 items-center justify-center bg-surface">
      <div className="flex gap-1">{[0,1,2].map(i => <span key={i} className="h-2 w-2 rounded-full bg-text-muted" style={{animation:`dot-b 800ms ease-in-out ${i*200}ms infinite`}} />)}</div>
    </div>
  );

  /* ── Empty ── */
  if (messages.length === 0) return (
    <div className="flex flex-1 items-center justify-center bg-surface">
      <p className="text-sm text-text-muted">No messages yet. Start a conversation!</p>
    </div>
  );

  return (
    <div ref={listRef} role="log" aria-live="polite" aria-relevant="additions" className="chat-scrollbar flex min-h-0 flex-1 flex-col overflow-y-scroll overflow-x-hidden bg-surface w-full">
      <style>{`@keyframes dot-b{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-5px);opacity:1}}@keyframes f-in{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes pop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}`}</style>

      <div className="flex flex-col px-2 sm:px-4">
        {/* Load-more sentinel */}
        <div ref={topSentinelRef} className="flex items-center justify-center py-2">
          {loadingMore && (
            <div className="flex items-center gap-2 text-text-muted">
              <div className="flex gap-1">{[0,1,2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full bg-text-muted" style={{animation:`dot-b 800ms ease-in-out ${i*200}ms infinite`}} />)}</div>
              <span className="text-xs">Loading older messages</span>
            </div>
          )}
          {!loadingMore && !hasMore && messages.length > 0 && <span className="text-xs text-text-muted">No more messages</span>}
        </div>

        {groups.map((group, gi) => {
          const showDate = gi === 0 || !isSameDay(groups[gi-1].messages[groups[gi-1].messages.length-1].createdAt, group.messages[0].createdAt);
          const [primary] = getAvatarColors(group.senderId);

          return (
            <div key={group.messages[0].id}>
              {showDate && (
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-border-subtle" />
                  <span className="text-xs tracking-wider text-text-muted uppercase shrink-0">{fmtDate(group.messages[0].createdAt)}</span>
                  <div className="flex-1 h-px bg-border-subtle" />
                </div>
              )}

              {group.messages.map((msg, mi) => {
                const isLast = mi === group.messages.length - 1;
                const isEditing = editingMessageId === String(msg.id);
                const anon = isAnon(msg);

                return (
                  <div key={`${group.messages[0].id}-${mi}`} className="group w-full" style={{ animation: "f-in 250ms cubic-bezier(.34,1.56,.64,1)", marginBottom: isLast ? 20 : 6 }}>

                    {/* Sender handle — first msg in group */}
                    {mi === 0 && (
                      <span className="block text-[11px] font-semibold tracking-wide select-none mb-1.5" style={{ color: group.isOwn ? "var(--color-text-secondary)" : primary, textAlign: group.isOwn ? "right" : "left" }}>
                        {group.isOwn ? (anon ? "You" : msg.senderName) : (anon ? "Anonymous User" : msg.senderName)}
                      </span>
                    )}

                    {/* Message row: avatar + bubble anchored at flex-end */}
                    <div className="flex" style={{ flexDirection: group.isOwn ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}>
                      {/* Avatar: hide identicon on own anon messages */}
                      {group.isOwn && anon ? (
                        <div className="shrink-0" style={{ width: 28 }} />
                      ) : (
                        <div className="shrink-0" style={{ animation: "pop 300ms cubic-bezier(.34,1.56,.64,1)" }}>
                          {anon ? (
                            <AnonymousUserAvatar size={28} />
                          ) : (
                            <UserAvatar imageUrl={msg.senderImage ?? null} userName={msg.senderName} size="sm" />
                          )}
                        </div>
                      )}

                      {/* Bubble */}
                      <div
                        className={`relative px-3.5 py-2 min-w-0 ${isEditing ? "border border-border bg-surface-raised shadow-lg" : "shadow-sm"}`}
                        style={{
                          maxWidth: "82%",
                          background: isEditing
                            ? "var(--color-surface-raised)"
                            : group.isOwn
                              ? (anon ? "#2a2a3a" : "var(--color-accent)")
                              : "var(--color-surface-elevated)",
                          borderRadius: isEditing ? "16px" : group.isOwn ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        }}
                      >
                        {isEditing ? (
                          <div>
                            <textarea
                              ref={editTextareaRef}
                              value={editText}
                              onChange={e => onEditTextChange(e.target.value)}
                              onKeyDown={e => handleEditKeyDown(e, onSaveEdit, onCancelEdit)}
                              autoFocus rows={1} placeholder="Edit message..." aria-label="Edit message"
                              className="w-full resize-none bg-transparent text-[15px]/[1.6] text-text-primary placeholder-text-muted outline-none"
                              style={{ maxHeight: "200px" }}
                            />
                            <div className="flex items-center justify-end gap-2 mt-2.5">
                              <button onClick={onCancelEdit} className="text-[12px] font-medium text-text-muted hover:text-text-secondary transition-colors">Cancel</button>
                              <button onClick={onSaveEdit} disabled={!editText.trim()} className="rounded-lg bg-accent px-3 py-1 text-[12px] font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-40">Save</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Content */}
                            {isImgUrl(msg.content ?? "") || msg.messageType === "image" ? (
                              <img src={msg.content} alt="Uploaded image" onClick={() => { if (onImageClick) onImageClick(msg.content); }} className="max-h-75 w-full rounded-2xl object-contain border border-border bg-surface-base cursor-pointer hover:opacity-90 transition-opacity" />
                            ) : (
                              <p className="text-sm whitespace-pre-wrap min-w-0" style={{ color: group.isOwn ? (anon ? "var(--color-text-primary)" : "white") : "var(--color-text-primary)", wordBreak: "break-word", overflowWrap: "break-word" }}>{msg.content ?? ""}</p>
                            )}

                            {/* Timestamp + status */}
                            <div className="flex items-center gap-1 mt-0.5" style={{ justifyContent: group.isOwn ? "flex-end" : "flex-start" }}>
                              <span className="text-[10px] select-none whitespace-nowrap" style={{ color: group.isOwn ? (anon ? "var(--color-text-muted)" : "rgba(255,255,255,0.55)") : "var(--color-text-muted)" }}>{fmtTime(msg.createdAt)}</span>
                              {msg.isEdited && <span className="text-[9px] select-none" style={{ color: group.isOwn ? (anon ? "var(--color-text-disabled)" : "rgba(255,255,255,0.4)") : "var(--color-text-disabled)" }}>(edited)</span>}
                              {group.isOwn && isLast && <CheckCheck className="h-3 w-3" style={{ color: anon ? "var(--color-text-muted)" : "rgba(255,255,255,0.5)" }} />}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Edit/Delete — own messages */}
                    {group.isOwn && !isEditing && (
                      <div className="flex gap-0.5 mt-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150" style={{ justifyContent: group.isOwn ? "flex-end" : "flex-start" }}>
                        <button onClick={() => onStartEdit(String(msg.id))} className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-surface-hover hover:text-text-secondary transition-colors" aria-label="Edit">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                        <button onClick={() => onDeleteClick(String(msg.id))} className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-surface-hover hover:text-accent-danger transition-colors" aria-label="Delete">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Typing indicator */}
        {streaming && (
          <div className="mb-3 flex w-full items-start justify-start">
            <div className="flex flex-col items-start gap-1">
              <div className="w-fit" style={{ borderRadius: "16px 16px 16px 4px", background: "var(--color-surface-elevated)" }}>
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
