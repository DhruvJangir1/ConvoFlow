import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { clerkFetch } from "../../lib/clerkFetch";
import { useAnonymousRoomQuery } from "../../hooks/useAnonymousRoomQuery";
import { useAnonymousMessagesQuery } from "../../hooks/useAnonymousMessagesQuery";
import {
  useAnonymousSendMessageMutation,
  useAnonymousEditMessageMutation,
  useAnonymousDeleteMessageMutation,
} from "../../hooks/useAnonymousMutations";
import AnonymousMessageFeed from "../../components/AnonymousMessageFeed";
import ConfirmModal from "../../modals/ConfirmModal";
import type { AnonymousChatMessages, MessageCursor } from "../../types/chat";
import AnonymousChatHeader from "./AnonymousChatHeader";
import AnonymousChatComposer from "./AnonymousChatComposer";
import { useWebSocket } from "../../context/WebSocketContext";

function insertMessageChronologically(
  messages: AnonymousChatMessages[],
  entry: AnonymousChatMessages,
): AnonymousChatMessages[] {
  const withoutEntry = messages.filter((message) => message.id !== entry.id);
  const entryTime = new Date(entry.createdAt).getTime();
  const insertionIndex = withoutEntry.findIndex((message) => {
    const messageTime = new Date(message.createdAt).getTime();
    return entryTime < messageTime || (entryTime === messageTime && entry.id.localeCompare(message.id) < 0);
  });

  if (insertionIndex === -1) return [...withoutEntry, entry];
  return [...withoutEntry.slice(0, insertionIndex), entry, ...withoutEntry.slice(insertionIndex)];
}

function mergeMessages(
  previous: AnonymousChatMessages[],
  server: AnonymousChatMessages[],
): AnonymousChatMessages[] {
  return server.reduce((messages, message) => insertMessageChronologically(messages, message), previous);
}

export default function AnonymousChat() {
  const { id: roomId } = useParams();
  const user = useSelector((s: RootState) => s.userAuth.user);
  const { subscribeToChats } = useWebSocket();
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
  const oldestCursorRef = useRef<MessageCursor | null>(null);
  const activeRoomRef = useRef<string | null>(null);
  const ownMessageIds = useRef<Set<string>>(new Set());

  const { data: roomDetail } = useAnonymousRoomQuery(roomId);
  const roomName = roomDetail ? roomDetail.name : "Anonymous Chat";
  const { data: messagesData } = useAnonymousMessagesQuery(roomId, ownMessageIds);
  const sendMessageMutation = useAnonymousSendMessageMutation();
  const editMessageMutation = useAnonymousEditMessageMutation();
  const deleteMessageMutation = useAnonymousDeleteMessageMutation();

  // Join room on mount and subscribe to it for real-time updates
  useEffect(() => {
    if (!roomId || !user) return;
    clerkFetch(`/api/anonymousChats/${roomId}/join`, { method: "POST" }).catch(() => {});
    subscribeToChats([roomId]);
  }, [roomId, user, subscribeToChats]);

  // Seed messages from cache
  useEffect(() => {
    if (!roomId) {
      queueMicrotask(() => {
        // Reset UI state when the room changes or disappears.
        setLoading(true);
        setMessages([]);
        setHasMore(true);
        oldestCursorRef.current = null;
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
        oldestCursorRef.current = null;
        ownMessageIds.current.clear();
      });
      return;
    }

    const switched = activeRoomRef.current !== roomId;
    activeRoomRef.current = roomId;

    queueMicrotask(() => {
      setMessages((prev) => {
        if (switched) return messagesData.messages;
        const merged = mergeMessages(prev, messagesData.messages);
        if (prev.length === merged.length &&
            prev.every((m, i) => m.id === merged[i].id)) {
          return prev;
        }
        return merged;
      });
      setLoading((prev) => prev ? false : prev);
      if (switched) {
        setHasMore(messagesData.hasMore);
        oldestCursorRef.current = messagesData.nextCursor;
      }
    });
  }, [messagesData, roomId]);

  async function loadMoreMessages() {
    if (!roomId || loadingMore || !hasMore || !oldestCursorRef.current || !user) return;
    setLoadingMore(true);
    try {
      const cursor = oldestCursorRef.current;
      if (!cursor) return;
      const res = await clerkFetch(
        `/api/anonymousChats/${roomId}/messages?beforeCreatedAt=${encodeURIComponent(cursor.beforeCreatedAt)}&beforeId=${encodeURIComponent(cursor.beforeId)}`,
      );
      if (!res.ok) throw new Error("Failed to load more messages");
      const data = await res.json() as { messages: { id: string; content: string | null; created_at: string; is_edited: boolean; isAnonymous: boolean; sender_id: string; users: { id: string; user_name: string; image_url: string | null } | null }[]; hasMore: boolean; nextCursor: MessageCursor | null };
      const newMsgs: AnonymousChatMessages[] = data.messages.map((m: { id: string; content: string | null; created_at: string; is_edited: boolean; isAnonymous: boolean; sender_id: string; users: { id: string; user_name: string; image_url: string | null } | null }) => {
        const isOwn = ownMessageIds.current.has(m.id) || m.sender_id === user.id;
        return {
          id: m.id,
          chatId: roomId,
          senderId: isOwn ? user.id : (m.isAnonymous ? "other" : (m.users ? m.users.id : "other")),
          senderName: m.isAnonymous ? "Anonymous" : (isOwn ? user.user_name : (m.users ? m.users.user_name : "Anonymous")),
          senderImage: m.isAnonymous ? null : (isOwn ? (user.image_url ?? null) : (m.users ? m.users.image_url : null)),
          content: m.content ?? "",
          createdAt: m.created_at,
          isOwn,
          isEdited: m.is_edited,
          messageType: 'text',
          isAnonymous: m.isAnonymous,
        };
      });
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const fresh = newMsgs.filter((m) => !existingIds.has(m.id));
        return [...fresh, ...prev];
      });
      setHasMore(data.hasMore === true);
      oldestCursorRef.current = data.nextCursor;
    } catch {
      // failed to load more messages
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
    };
    setMessages((prev) => [...prev, optimistic]);
    setMessageText("");

    sendMessageMutation.mutate(
      { roomId, content: trimmed, userId: user.id, isAnonymous },
      {
        onSuccess: (data) => {
          ownMessageIds.current.delete(tempId);
          ownMessageIds.current.add(data.message.id);
          setMessages((prev) => {
            const optimisticMessage = prev.find((message) => message.id === tempId);
            if (!optimisticMessage) return prev;
            const confirmedMessage: AnonymousChatMessages = {
              id: data.message.id,
              chatId: roomId,
              senderId: user.id,
              senderName: isAnonymous ? "Anonymous" : user.user_name,
              senderImage: isAnonymous ? null : (user.image_url ?? null),
              content: data.message.content ?? '',
              createdAt: data.message.created_at,
              isOwn: true,
              isEdited: data.message.is_edited,
              messageType: 'text',
              isAnonymous,
            };
            return insertMessageChronologically(
              prev.filter((message) => message.id !== tempId),
              confirmedMessage,
            );
          });
        },
        onError: () => {
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
        onError: () => {
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
        onError: () => {
          setMessages(prevMessages);
        },
      },
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col bg-surface">
      <AnonymousChatHeader roomName={roomName} />
      <AnonymousMessageFeed
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
      />
      <div className="safe-area-bottom">
        <AnonymousChatComposer
          value={messageText}
          onChange={setMessageText}
          onSend={sendMessage}
          isAnonymous={isAnonymous}
          onAnonymousToggle={() => setIsAnonymous((p) => !p)}
        />
      </div>
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
