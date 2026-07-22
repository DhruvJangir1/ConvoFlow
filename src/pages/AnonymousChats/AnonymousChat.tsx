import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { useWebSocket } from "../../context/WebSocketContext";
import { clerkFetch } from "../../lib/clerkFetch";
import { useAnonymousRoomQuery } from "../../hooks/useAnonymousRoomQuery";
import { useAnonymousMessagesQuery } from "../../hooks/useAnonymousMessagesQuery";
import {
  useAnonymousSendMessageMutation,
  useAnonymousEditMessageMutation,
  useAnonymousDeleteMessageMutation,
  useAnonymousVoteMutation,
} from "../../hooks/useAnonymousMutations";
import MessageList from "../../components/MessageList";
import ConfirmModal from "../../modals/ConfirmModal";
import type { AnonymousChatMessages } from "../../types/chat";
import AnonymousChatHeader from "./AnonymousChatHeader";
import AnonymousChatComposer from "./AnonymousChatComposer";

export default function AnonymousChat() {
  const { id: roomId } = useParams();
  const user = useSelector((s: RootState) => s.userAuth.user);
  const { subscribeToChats, onMessage } = useWebSocket();

  const [messages, setMessages] = useState<AnonymousChatMessages[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const oldestDateRef = useRef<string | null>(null);
  const prevRoomRef = useRef<string | null>(null);
  const ownMessageIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!roomId || !user) return;

    prevRoomRef.current = roomId;
    subscribeToChats([roomId]);

  }, [roomId, user, subscribeToChats]);

  const { data: roomDetail } = useAnonymousRoomQuery(roomId);
  const roomName = roomDetail?.name ?? "Anonymous Chat";
  const { data: messagesData } = useAnonymousMessagesQuery(roomId, ownMessageIds);
  const sendMessageMutation = useAnonymousSendMessageMutation();
  const editMessageMutation = useAnonymousEditMessageMutation();
  const deleteMessageMutation = useAnonymousDeleteMessageMutation();
  const voteMutation = useAnonymousVoteMutation();

  // Join room on mount
  useEffect(() => {
    if (!roomId || !user) return;
    clerkFetch(`/api/anonymousChats/${roomId}/join`, { method: "POST" }).catch((err) =>
      console.error(err),
    );
  }, [roomId, user]);

  // Seed messages from cache
  useEffect(() => {
    if (!roomId) {
      queueMicrotask(() => {
        // Reset UI state when the room changes or disappears.
        setLoading(true);
        setMessages([]);
        setHasMore(true);
        oldestDateRef.current = null;
        ownMessageIds.current.clear();
      });
      return;
    }

    if (!messagesData) {
      queueMicrotask(() => {
        // Keep the list empty until the query resolves.
        setLoading(true);
        setMessages([]);
        setHasMore(true);
        oldestDateRef.current = null;
        ownMessageIds.current.clear();
      });
      return;
    }

    queueMicrotask(() => {
      // Hydrate the list once the fetched messages are ready.
      setMessages(messagesData.messages);
      setHasMore(messagesData.hasMore);
      setLoading(false);
      if (messagesData.messages.length > 0) {
        oldestDateRef.current = messagesData.messages[0].createdAt;
      } else {
        oldestDateRef.current = null;
        ownMessageIds.current.clear();
      }
    });
  }, [messagesData, roomId]);

  useEffect(() => {
    if (!roomId || !user) return;
    const unsub = onMessage((msg) => {
      if (msg.type === 'message:new' && msg.payload.chatId === roomId) {
        const isOwn = ownMessageIds.current.has(msg.payload.id) || msg.payload.senderId === user.id;
        const isAnon = msg.payload.isAnonymous ?? true;

        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.payload.id)) return prev;
          return [...prev, {
            id: msg.payload.id,
            chatId: roomId,
            content: msg.payload.content,
            senderId: isOwn ? user.id : (isAnon ? "other" : (msg.payload.senderId ?? "other")),
            senderName: isAnon ? "Anonymous" : (isOwn ? user.user_name : (msg.payload.senderName ?? "Anonymous")),
            senderImage: isAnon ? null : (msg.payload.senderImage ?? null),
            createdAt: msg.payload.createdAt,
            isOwn,
            isEdited: false,
            messageType: 'text',
            isAnonymous: isAnon,
            totalUpvotes: 0,
            userVote: null,
          }];
        });
      }
    });
    return unsub;
  }, [roomId, user, onMessage]);

  async function loadMoreMessages() {
    if (!roomId || loadingMore || !hasMore || !oldestDateRef.current || !user) return;
    setLoadingMore(true);
    try {
      const res = await clerkFetch(
        `/api/anonymousChats/${roomId}/messages?before=${encodeURIComponent(oldestDateRef.current)}`,
      );
      if (!res.ok) throw new Error("Failed to load more messages");
      const data = await res.json();
      const newMsgs = data.messages.map((m: { id: string; content: string | null; created_at: string; is_edited?: boolean; TotalUpvotes?: number; userVote?: string | null; isAnonymous?: boolean; sender_id?: string; users?: { id: string; user_name: string; image_url: string | null } | null }) => {
        const isOwn = ownMessageIds.current.has(m.id) || m.sender_id === user.id;
        const isAnon = m.isAnonymous ?? true;
        return {
          id: m.id,
          chatId: roomId,
          senderId: isOwn ? user.id : (isAnon ? "other" : (m.users?.id ?? "other")),
          senderName: isAnon ? "Anonymous" : (isOwn ? user.user_name : (m.users?.user_name ?? "Anonymous")),
          senderImage: isAnon ? null : (isOwn ? (user.image_url ?? null) : (m.users?.image_url ?? null)),
          content: m.content ?? "",
          createdAt: m.created_at,
          isOwn,
          isEdited: m.is_edited ?? false,
          messageType: 'text',
          totalUpvotes: m.TotalUpvotes ?? 0,
          userVote: (m.userVote as 'upvote' | 'downvote' | null) ?? null,
          isAnonymous: isAnon,
        };
      });
      setMessages((prev) => [...newMsgs, ...prev]);
      setHasMore(data.hasMore ?? false);
      if (newMsgs.length > 0) {
        oldestDateRef.current = newMsgs[0].createdAt;
      }
    } catch (err) {
      console.error("[AnonymousChat] loadMore error:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  async function sendMessage() {
    if (!roomId || !messageText.trim() || !user) return;
    const trimmed = messageText.trim();
    const tempId = `temp-${Date.now()}`;

    ownMessageIds.current.add(tempId);

    const optimistic: AnonymousChatMessages = {
      id: tempId,
      chatId: roomId,
      senderId: user.id,
      senderName: isAnonymous ? "Anonymous" : user.user_name,
      senderImage: isAnonymous ? null : (user.image_url ?? null),
      content: trimmed,
      createdAt: new Date().toISOString(),
      isOwn: true,
      isEdited: false,
      messageType: 'text',
      isAnonymous,
      totalUpvotes: 0,
      userVote: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setMessageText("");

    sendMessageMutation.mutate(
      { roomId, content: trimmed, userId: user.id, isAnonymous },
      {
        onSuccess: (data) => {
          ownMessageIds.current.delete(tempId);
          ownMessageIds.current.add(data.message.id);
          setMessages((prev) =>
            prev
              .filter((m) => m.id !== data.message.id)
              .map((m) =>
                m.id === tempId
                  ? { id: data.message.id, chatId: roomId, senderId: user.id, senderName: isAnonymous ? "Anonymous" : user.user_name, senderImage: isAnonymous ? null : (user.image_url ?? null), content: data.message.content ?? '', createdAt: data.message.created_at, isOwn: true, isEdited: data.message.is_edited ?? false, messageType: 'text', isAnonymous, totalUpvotes: 0, userVote: null }
                  : m,
              ),
          );
        },
        onError: (err) => {
          console.error("[AnonymousChat] send error:", err);
          ownMessageIds.current.delete(tempId);
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
        },
      },
    );
  }

  function startEdit(msgId: string) {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    setEditingMessageId(msgId);
    setEditText(msg.content);
  }

  function cancelEdit() {
    setEditingMessageId(null);
    setEditText("");
  }

  async function saveEdit() {
    if (!editingMessageId || !editText.trim() || !roomId) return;
    const newContent = editText.trim();
    const prevMessages = [...messages];
    setMessages((prev) =>
      prev.map((m) => (m.id === editingMessageId ? { ...m, content: newContent, isEdited: true } : m)),
    );
    setEditingMessageId(null);
    setEditText("");

    editMessageMutation.mutate(
      { roomId, messageId: editingMessageId, content: newContent },
      {
        onError: (err) => {
          console.error("[AnonymousChat] edit error:", err);
          setMessages(prevMessages);
        },
      },
    );
  }

  async function confirmDelete() {
    if (!roomId || !deletingMessageId) return;
    const msgId = deletingMessageId;
    const prevMessages = [...messages];
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setDeletingMessageId(null);
    setDeleteModalOpen(false);

    deleteMessageMutation.mutate(
      { roomId, messageId: msgId },
      {
        onError: (err) => {
          console.error("[AnonymousChat] delete error:", err);
          setMessages(prevMessages);
        },
      },
    );
  }

  async function handleUpvote(messageId: string) {
    const prevMessages = [...messages];

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const t = m.totalUpvotes ?? 0;

        // if a user is upvoting a message they already upvoted, remove the upvote
        if (m.userVote === "upvote" && t > 0) {
          return { ...m, totalUpvotes: t - 1, userVote: null };
        }
        // if a message is already downvoted, then upvoting it remove the downvote from that and increases by 1
        if (m.userVote === "downvote") {
          return { ...m, totalUpvotes: t + 1, userVote: "upvote" };
        }
        // if nothing was previously done to it
        return { ...m, totalUpvotes: t + 1, userVote: "upvote" };
      }),
    );

    if (!roomId){
      console.log('no room found')
    return;}

    if (!user){
console.log('no user found')
return;
    }

    voteMutation.mutate(
      { roomId, messageId, type: 'upvote' },
      {
        onError: () => setMessages(prevMessages),
      },
    );
  }

  async function handleDownvote(messageId: string) {
    const prevMessages = [...messages];

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const t = m.totalUpvotes ?? 0;
        if (m.userVote === "downvote") {
          return { ...m, totalUpvotes: t + 1, userVote: null };
        }
        if (m.userVote === "upvote") {
          const next = t - 2;
          return { ...m, totalUpvotes: next < 0 ? 0 : next, userVote: "downvote" };
        }
        const next = t - 1;
        return { ...m, totalUpvotes: next < 0 ? 0 : next, userVote: "downvote" };
      }),
    );

    if (!roomId) return;
    voteMutation.mutate(
      { roomId, messageId, type: 'downvote' },
      {
        onError: () => setMessages(prevMessages),
      },
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col bg-surface">
      <AnonymousChatHeader roomName={roomName} />
      <MessageList
        messages={messages}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMoreMessages}
        streaming={false}
        editingMessageId={editingMessageId}
        editText={editText}
        onEditTextChange={setEditText}
        onStartEdit={startEdit}
        onSaveEdit={saveEdit}
        onCancelEdit={cancelEdit}
        onDeleteClick={(msgId) => {
          setDeletingMessageId(msgId);
          setDeleteModalOpen(true);
        }}
        showVoting
        onUpvote={handleUpvote}
        onDownvote={handleDownvote}
      />
      <AnonymousChatComposer
        value={messageText}
        onChange={setMessageText}
        onSend={sendMessage}
        isAnonymous={isAnonymous}
        onAnonymousToggle={() => setIsAnonymous((p) => !p)}
      />
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeletingMessageId(null); }}
        onConfirm={confirmDelete}
        title="Delete message?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  );
}
