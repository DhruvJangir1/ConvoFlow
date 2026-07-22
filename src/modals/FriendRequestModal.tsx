import { useState } from "react";
import { X, Loader2, UserCheck, UserX, AlertCircle } from "lucide-react";
import { clerkFetch } from "../lib/clerkFetch";

interface FriendRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  senderName: string;
  senderUserId: string;
  entityId: string;
  notificationId: string;
  onAccepted: (chatId: string) => void;
  onRejected: (notificationId: string) => void;
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

export default function FriendRequestModal({
  isOpen,
  onClose,
  senderName,
  senderUserId,
  entityId,
  notificationId,
  onAccepted,
  onRejected,
}: FriendRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAccept = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clerkFetch(`/api/friends/${entityId}/accept`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId, sender_user_id: senderUserId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setError(err.error ?? 'Failed to accept friend request');
        return;
      }
      const data = await res.json();
      onAccepted(data.chat?.id);
    } catch (err) {
      setError('Network error — is the server running?');
      console.error('[FriendRequestModal] Accept error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clerkFetch(`/api/friends/${entityId}/reject`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setError(err.error ?? 'Failed to reject friend request');
        return;
      }
      onRejected(notificationId);
    } catch (err) {
      setError('Network error — is the server running?');
      console.error('[FriendRequestModal] Reject error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[8vh] sm:pt-[15vh] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div
        className="w-full max-w-sm mx-2 sm:mx-0 rounded-2xl border border-border bg-surface-elevated shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] sm:text-[17px] font-semibold text-text-primary">Friend Request</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full text-lg sm:text-xl font-semibold text-white"
            style={{ background: avatarGradient(senderName) }}
          >
            {getInitials(senderName)}
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-text-primary">{senderName}</h3>
          <p className="mt-1 text-sm text-text-muted">wants to be friends with you</p>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="mt-5 sm:mt-6 flex items-center justify-center gap-3">
            <button
              onClick={handleReject}
              disabled={loading}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserX className="h-3.5 w-3.5" />
              )}
              Reject
            </button>
            <button
              onClick={handleAccept}
              disabled={loading}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <UserCheck className="h-3.5 w-3.5" />
                  Accept
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
