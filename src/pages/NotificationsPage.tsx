/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, UserCheck, UserX, Bell, Loader2, Send, ArrowLeft, Trash2 } from "lucide-react";
import { useDispatch } from "react-redux";
import { resetUnreadNotif } from "../store/userAuthSlice";
import { addChat } from "../store/chatSlice";
import { useNotificationsQuery } from "../hooks/useNotificationsQuery";
import {
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useRejectFriendRequest,
  useAcceptFriendRequest,
  useDeleteNotification,
  useDeleteAllNotifications,
} from "../hooks/useNotificationMutations";
import AddFriendModal from "../modals/AddFriendModal";
import ConfirmDeleteAllNotificationModal from "../modals/ConfirmDeleteAllNotificationModal";
import type { Notification } from "../types/chat";
import type { Chat } from "../types/chat";
import { useQueryClient } from "@tanstack/react-query";
import { chatKeys } from "../lib/queryKeys";

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  friend_request: {
    icon: UserPlus,
    color: "text-accent-info",
    bg: "bg-accent-info/10",
  },
  friend_request_accepted: {
    icon: UserCheck,
    color: "text-accent-success",
    bg: "bg-accent-success/10",
  },
  friend_request_rejected: {
    icon: UserX,
    color: "text-accent-danger",
    bg: "bg-accent-danger/10",
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
  const deleteMutation = useDeleteNotification();
  const deleteAllMutation = useDeleteAllNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [acceptSenderName, setAcceptSenderName] = useState("");
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

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

  const handleDelete = useCallback((id: string) => {
    setActionLoading(id);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        removeNotification(id);
      },
      onSettled: () => {
        setActionLoading(null);
      },
    });
  }, [deleteMutation]);

  const handleDeleteAll = useCallback(() => {
    setDeleteAllOpen(false);
    deleteAllMutation.mutate(undefined, {
      onSuccess: () => {
        setNotifications([]);
        dispatch(resetUnreadNotif());
      },
    });
  }, [deleteAllMutation, dispatch]);

  const handleReject = useCallback(async (notification: Notification) => {
    setActionLoading(notification.id);
    rejectMutation.mutate(notification.entity_id, {
      onSettled: () => {
        removeNotification(notification.id);
        setActionLoading(null);
      },
    });
  }, [rejectMutation]);

  const handleAccept = useCallback(async (notification: Notification) => {
    const senderName = notification.content ? notification.content.replace(' sent you a friend request', '') : 'Friend';
    setAcceptSenderName(senderName);
    setAcceptLoading(true);
    acceptMutation.mutate(notification, {
      onSuccess: (data) => {
        try {
          removeNotification(notification.id);
          const chatId = data.chat.id;
          if (!chatId) {
            setAcceptLoading(false);
            setActionLoading(null);
            return;
          }
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
          dispatch(addChat(newChat));
          queryClient.setQueryData(chatKeys.messages(chatId), { messages: [], hasMore: false });
          navigate(`/chat/${chatId}`);
        } catch {
          setAcceptLoading(false);
          setActionLoading(null);
        }
      },
      onError: () => {
        setAcceptLoading(false);
        setActionLoading(null);
      },
      onSettled: () => {
        setActionLoading(null);
      },
    });
  }, [acceptMutation, dispatch, queryClient, navigate]);

  const handleCreateChat = useCallback(async (notification: Notification) => {
    markAsRead(notification.id);
    const targetId = notification.entity_id;
    if (!targetId) return;
    if (notification.type === 'friend_request_accepted') {
      const chats = queryClient.getQueryData<Chat[]>(chatKeys.lists());
      if (chats) {
        const match = chats.find(
          (c) => c.type === 'dm' && c.members.some((m) => m.id === notification.sender_user_id),
        );
        if (match) {
          navigate(`/chat/${match.id}`);
          return;
        }
      }
      navigate(`/chat/${targetId}`);
    }
  }, [navigate, markAsRead, queryClient]);

  const unread = notifications.filter(n => !n.read_at);
  const read = notifications.filter(n => n.read_at);

  function renderNotification(n: Notification) {
    const config = typeConfig[n.type] ?? { icon: Bell, color: "text-accent", bg: "bg-accent/10" };
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
            ? "border-accent-warning/30 bg-accent-warning/5"
            : "border-border bg-surface-elevated"
        }`}>
          <div className="flex items-start justify-between gap-2 sm:gap-4">
            <h3 className="text-sm font-semibold text-text-primary break-words">
              {n.content ?? n.type}
            </h3>
            <span className="shrink-0 text-xs text-text-muted">
              {relativeTime(n.created_at)}
            </span>
          </div>

          {isFriendReq && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => handleAccept(n)}
                disabled={actionLoading === n.id}
                className="flex items-center gap-1.5 rounded-md bg-accent-success/10 px-3 py-1.5 text-xs font-medium text-accent-success transition-colors hover:bg-accent-success/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading === n.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'Reject'
                )}
              </button>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            {n.type === 'friend_request_accepted' && (
              <button
                onClick={() => handleCreateChat(n)}
                className="flex items-center gap-1.5 rounded-md bg-accent-success/10 px-3 py-1.5 text-xs font-medium text-accent-success transition-colors hover:bg-accent-success/20"
              >
                <Send className="h-3 w-3" />
                Send Message
              </button>
            )}
            <div className="ml-auto flex">
              <button
                onClick={() => handleDelete(n.id)}
                disabled={actionLoading === n.id}
                aria-label="Delete notification"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-accent-danger/10 text-accent-danger transition-colors hover:bg-accent-danger/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading === n.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {isUnread && (
          <span className="absolute right-2 -top-1 h-2 w-2 rounded-full bg-accent-warning" />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-text-primary">Notifications</h1>
        </div>
        <div className="flex items-center gap-2">
          {unread.length > 0 && (
            <button
              onClick={markAllAsRead}
              className="shrink-0 rounded-md bg-accent-warning/10 px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-medium text-accent-warning transition-colors hover:bg-accent-warning/20"
            >
              Mark all as read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => setDeleteAllOpen(true)}
              disabled={deleteAllMutation.isPending}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md bg-accent-danger/10 px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-medium text-accent-danger transition-colors hover:bg-accent-danger/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteAllMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Delete all
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="relative px-3 sm:px-6 py-4 sm:py-5">
          <div className="absolute bottom-0 left-6 sm:left-10.25 top-0 w-px bg-border" />

          {notifLoading ? (
            <p className="text-sm text-text-muted">Loading...</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-text-muted">No notifications yet</p>
          ) : (
            <div className="relative space-y-6">
              {unread.length > 0 && (
                <section>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Unread ({unread.length})
                  </h2>
                  <div className="space-y-4">
                    {unread.map(renderNotification)}
                  </div>
                </section>
              )}

              {read.length > 0 && (
                <section>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
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
      <ConfirmDeleteAllNotificationModal
        isOpen={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={handleDeleteAll}
      />
    </div>
  );
}
