/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, UserCheck, UserX, Bell, Loader2, Send, ArrowLeft } from "lucide-react";
import { useDispatch } from "react-redux";
import { resetUnreadNotif } from "../store/userAuthSlice";
import { addChat } from "../store/chatSlice";
import { useNotificationsQuery } from "../hooks/useNotificationsQuery";
import {
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useRejectFriendRequest,
  useAcceptFriendRequest,
} from "../hooks/useNotificationMutations";
import AddFriendModal from "../modals/AddFriendModal";
import type { Notification } from "../types/chat";
import type { Chat } from "../types/chat";
import { useQueryClient } from "@tanstack/react-query";
import { chatKeys } from "../lib/queryKeys";
import { useWebSocket } from "../context/WebSocketContext";

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
  friend_request_rejected: {
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
  const queryClient = useQueryClient();
  const { data: notifData, isLoading: notifLoading } = useNotificationsQuery();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const rejectMutation = useRejectFriendRequest();
  const acceptMutation = useAcceptFriendRequest();
  const { subscribeToChats } = useWebSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [acceptSenderName, setAcceptSenderName] = useState("");

    function removeNotification(id: string) {
    setNotifications(prev => prev.filter(x => x.id !== id));
  }

  useEffect(() => {
    dispatch(resetUnreadNotif());
  }, [dispatch]);

  // Seed local state from TanStack cache
  useEffect(() => {
    if (notifData) {
      setNotifications(notifData);
    }
  }, [notifData]);

  const markAsRead = useCallback((id: string) => {
    markReadMutation.mutate(id);
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  }, [markReadMutation]);

  const markAllAsRead = useCallback(() => {
    markAllReadMutation.mutate();
    setNotifications(prev =>
      prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
    dispatch(resetUnreadNotif());
  }, [markAllReadMutation, dispatch]);

  const handleReject = useCallback(async (notification: Notification) => {
    setActionLoading(notification.id);
    rejectMutation.mutate(notification.entity_id, {
      onError: (err) => {
        console.error('[NotificationsPage] Reject failed:', err);
      },
      onSettled: () => {
        removeNotification(notification.id);
        setActionLoading(null);
      },
    });
  }, [rejectMutation]);

  const handleAccept = useCallback(async (notification: Notification) => {
    const senderName = notification.content?.replace(' sent you a friend request', '') ?? 'Friend';
    setAcceptSenderName(senderName);
    setAcceptLoading(true);
    acceptMutation.mutate(notification, {
      onSuccess: (data) => {
        console.log('[NotificationsPage] Accept mutation onSuccess fired, data:', data);
        try {
          removeNotification(notification.id);
          const chatId = data.chat?.id;
          if (!chatId) {
            console.error('[NotificationsPage] Accept succeeded but no chat ID returned');
            setAcceptLoading(false);
            setActionLoading(null);
            return;
          }
          console.log('[NotificationsPage] Building newChat for dispatch, chatId:', chatId);
          const newChat: Chat = {
            id: chatId,
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
          };
          console.log('[NotificationsPage] Dispatching addChat to Redux');
          dispatch(addChat(newChat));
          console.log('[NotificationsPage] Setting messages cache for chat', chatId);
          queryClient.setQueryData(chatKeys.messages(chatId), { messages: [], hasMore: false });
          console.log('[NotificationsPage] Calling subscribeToChats');
          subscribeToChats([chatId]);
          console.log('[NotificationsPage] Navigating to /chat/' + chatId);
          navigate(`/chat/${chatId}`);
          console.log('[NotificationsPage] Navigation call completed');
        } catch (err) {
          console.error('[NotificationsPage] onSuccess error:', err);
          setAcceptLoading(false);
          setActionLoading(null);
        }
      },
      onError: (err) => {
        console.error('[NotificationsPage] Accept error:', err);
        setAcceptLoading(false);
        setActionLoading(null);
      },
      onSettled: () => {
        setActionLoading(null);
      },
    });
  }, [acceptMutation, dispatch, queryClient, subscribeToChats, navigate]);

  const handleCreateChat = useCallback(async (notification: Notification) => {
    markAsRead(notification.id);
    const targetId = notification.entity_id;
    if (!targetId) return;
    if (notification.type === 'friend_request_accepted') {
      const chats = queryClient.getQueryData<Chat[]>(chatKeys.lists());
      const match = chats?.find(
        (c) => c.type === 'dm' && c.members?.some((m) => m.id === notification.sender_user_id),
      );
      if (match) {
        navigate(`/chat/${match.id}`);
        return;
      }
    }
    navigate(`/chat/${targetId}`);
  }, [navigate, markAsRead, queryClient]);

  const unread = notifications.filter(n => !n.read_at);
  const read = notifications.filter(n => n.read_at);

  function renderNotification(n: Notification) {
    const config = typeConfig[n.type] ?? { icon: Bell, color: "text-blue-400", bg: "bg-blue-500/10" };
    const Icon = config.icon;
    const isUnread = !n.read_at;
    const isFriendReq = n.type === 'friend_request';
    return (
      <div key={n.id} className="relative flex gap-2 sm:gap-4">
        <div className="relative z-10 flex shrink-0 items-start pt-3.5">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full ${config.bg}`}>
            <Icon className={`h-3.5 w-3.5 ${config.color}`} />
          </div>
        </div>

        <div className={`min-w-0 flex-1 rounded-xl border p-3 sm:p-4 ${
          isUnread
            ? "border-yellow-500/30 bg-[#1c1a10]"
            : "border-zinc-800/50 bg-[#17171a]"
        }`}>
          <div className="flex items-start justify-between gap-2 sm:gap-4">
            <h3 className="text-sm font-semibold text-zinc-100 break-words">
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
                className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading === n.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'Accept'
                )}
              </button>
              <button
                onClick={() => handleReject(n)}
                disabled={actionLoading === n.id}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading === n.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'Reject'
                )}
              </button>
            </div>
          )}

          {n.type === 'friend_request_accepted' && (
            <div className="mt-3">
              <button
                onClick={() => handleCreateChat(n)}
                className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
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
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-zinc-100">Notifications</h1>
        </div>
        {unread.length > 0 && (
          <button
            onClick={markAllAsRead}
            className="shrink-0 rounded-md bg-yellow-500/10 px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-medium text-yellow-400 transition-colors hover:bg-yellow-500/20"
          >
            Mark all as read
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="relative px-3 sm:px-6 py-4 sm:py-5">
          <div className="absolute bottom-0 left-6 sm:left-10.25 top-0 w-px bg-zinc-800" />

          {notifLoading ? (
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

      <AddFriendModal isOpen={acceptLoading} senderName={acceptSenderName} />
    </div>
  );
}
