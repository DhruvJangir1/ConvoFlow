/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, UserCheck, UserX, Bell, Loader2, Send } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { resetUnreadNotif } from "../store/userAuthSlice";
import { addChat } from "../store/chatSlice";
import AcceptLoadingModal from "../modals/AcceptLoadingModal";
import type { Notification } from "../types/chat";

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  friend_request: {
    icon: UserPlus,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  friend_request_accepted: {
    icon: UserCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  friend_request_declined: {
    icon: UserX,
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.userAuth.user);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [acceptLoading, setAcceptLoading] = useState(false);

    function removeNotification(id: string) {
    setNotifications(prev => prev.filter(x => x.id !== id));
  }

  useEffect(() => {
    dispatch(resetUnreadNotif());
  }, [dispatch]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch('/api/notifications', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setNotifications(data.notifications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const markAsRead = useCallback((id: string) => {
    fetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      credentials: 'include',
    }).catch(() => {});
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    fetch('/api/notifications/read-all', {
      method: 'PATCH',
      credentials: 'include',
    }).catch(() => {});
    setNotifications(prev =>
      prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
    dispatch(resetUnreadNotif());
  }, [dispatch]);

  const handleDecline = useCallback(async (notification: Notification) => {
    setActionLoading(notification.id);
    try {
      const res = await fetch(`/api/friends/${notification.entity_id}/decline`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        console.error('[NotificationsPage] Decline failed:', err.error);
        return;
      }
      removeNotification(notification.id);
    } catch (err) {
      console.error('[NotificationsPage] Decline error:', err);
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleAccept = useCallback(async (notification: Notification) => {
    setAcceptLoading(true);
    try {
      const res = await fetch(`/api/friends/accept`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        console.error('[NotificationsPage] Accept failed:', err.error);
        return;
      }
      const data = await res.json();
      markAsRead(notification.id);
      removeNotification(notification.id);
      dispatch(addChat({
        id: data.chat.id,
        name: data.chat.name ?? data.senderName ?? 'Unknown',
        avatar_url: data.chat.avatar_url ?? null,
        lastMessage: '',
        timestamp: Date.now(),
        unread: 0,
        type: 'dm',
        messageCount: 0,
        members: [{
          id: notification.sender_user_id,
          user_name: data.senderName ?? 'Unknown',
          image_url: null,
        }],
      }));

      if (data.chat.id) {
        navigate(`/chat/${data.chat.id}`);
      }
      
    } catch (err) {
      console.error('[NotificationsPage] Accept error:', err);
    } finally {
      setAcceptLoading(false);
      setActionLoading(null);
    }
  }, [navigate, markAsRead, dispatch]);

  const handleCreateChat = useCallback(async (notification: Notification) => {
        markAsRead(notification.id);
    if (notification.entity_id) {
      navigate(`/chat/${notification.entity_id}`);
    }
  }, [navigate, markAsRead]);

  const unread = notifications.filter(n => !n.read_at);
  const read = notifications.filter(n => n.read_at);

  function renderNotification(n: Notification) {
    const config = typeConfig[n.type] ?? { icon: Bell, color: "text-blue-400", bg: "bg-blue-500/10" };
    const Icon = config.icon;
    const isUnread = !n.read_at;
    const isFriendReq = n.type === 'friend_request';
    return (
      <div key={n.id} className="relative flex gap-4">
        <div className="relative z-10 flex shrink-0 items-start pt-3.5">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full ${config.bg}`}>
            <Icon className={`h-3.5 w-3.5 ${config.color}`} />
          </div>
        </div>

        <div className={`min-w-0 flex-1 rounded-xl border p-4 ${
          isUnread
            ? "border-yellow-500/30 bg-[#1c1a10]"
            : "border-zinc-800/50 bg-[#17171a]"
        }`}>
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-sm font-semibold text-zinc-100">
              {n.content ?? n.type}
            </h3>
            <span className="shrink-0 text-xs text-zinc-500">
              {relativeTime(n.created_at)}
            </span>
          </div>

          {isFriendReq && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => handleAccept(n)}
                disabled={actionLoading === n.id}
                className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading === n.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'Accept'
                )}
              </button>
              <button
                onClick={() => handleDecline(n)}
                disabled={actionLoading === n.id}
                className="flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading === n.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'Decline'
                )}
              </button>
            </div>
          )}

          {n.type === 'friend_request_accepted' && (
            <div className="mt-3">
              <button
                onClick={() => handleCreateChat(n)}
                className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                <Send className="h-3 w-3" />
                Send Message
              </button>
            </div>
          )}
        </div>

        {isUnread && (
          <span className="absolute right-2 top-3 h-2 w-2 rounded-full bg-yellow-400" />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-[#121214]">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
        <h1 className="text-lg font-semibold text-zinc-100">Notifications</h1>
        {unread.length > 0 && (
          <button
            onClick={markAllAsRead}
            className="rounded-md bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400 transition-colors hover:bg-yellow-500/20"
          >
            Mark all as read
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="relative px-6 py-5">
          <div className="absolute bottom-0 left-10.25 top-0 w-px bg-zinc-800" />

          {loading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-zinc-500">No notifications yet</p>
          ) : (
            <div className="relative space-y-6">
              {unread.length > 0 && (
                <section>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Unread ({unread.length})
                  </h2>
                  <div className="space-y-4">
                    {unread.map(renderNotification)}
                  </div>
                </section>
              )}

              {read.length > 0 && (
                <section>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Read ({read.length})
                  </h2>
                  <div className="space-y-4">
                    {read.map(renderNotification)}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      <AcceptLoadingModal isOpen={acceptLoading} />
    </div>
  );
}
