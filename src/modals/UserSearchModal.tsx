import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, MessageCircle, X } from "lucide-react";

interface UserResult {
  id: string;
  user_name: string;
  email: string;
  image_url: string | null;
  is_verified: boolean;
  user_tag: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function hashToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function avatarGradient(name: string): string {
  const hue = hashToHue(name);
  return `linear-gradient(135deg, hsl(${hue}, 60%, 40%), hsl(${(hue + 60) % 360}, 50%, 30%))`;
}

export default function UserSearchModal({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q.trim())}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data.users || []);
    } catch (err) {
      console.error('[UserSearch] search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleCreateDm = async (targetUser: UserResult) => {
    setCreating(targetUser.id);
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ participantIds: [targetUser.id] }),
      });
      if (!res.ok) throw new Error('Failed to create chat');
      const data = await res.json();
      onClose();
      navigate(`/chat/${data.chat.id}`);
    } catch (err) {
      console.error('[UserSearch] create DM error:', err);
    } finally {
      setCreating(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[15vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface-elevated shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[17px] font-semibold text-text-primary">New Conversation</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 transition-colors duration-150 focus-within:border-accent">
            <Search className="h-4 w-4 shrink-0 text-text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search by username or email..."
              aria-label="Search users"
              className="flex-1 bg-transparent text-[14px] text-text-primary placeholder-text-muted outline-none"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
            </div>
          )}

          {!loading && query.trim().length > 0 && results.length === 0 && (
            <div className="py-8 text-center text-sm text-text-muted">
              No users found
            </div>
          )}

          {!loading && results.map((u) => (
            <button
              key={u.id}
              onClick={() => handleCreateDm(u)}
              disabled={creating === u.id}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-hover disabled:opacity-50"
            >
              {u.image_url ? (
                <img src={u.image_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: avatarGradient(u.user_name) }}
                >
                  {getInitials(u.user_name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-medium text-text-primary">
                    {u.user_name}
                  </span>
                  {u.is_verified && (
                    <span className="shrink-0 rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">
                      verified
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-muted">{u.email}</span>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                {creating === u.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
