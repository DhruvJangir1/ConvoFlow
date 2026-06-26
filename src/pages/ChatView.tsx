import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { useChats } from "../context/ChatContext";
import { useWebSocket } from "../context/WebSocketContext";
import { useParams } from "react-router-dom";
import ChatHeader from "../components/ChatHeader";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import ConfirmModal from "../modals/ConfirmModal";
import type { ChatMessages, Reaction } from "../types/chat";

function buildMessage(raw: { id: string; sender_id: string; content: string; created_at: string; is_edited?: boolean; users?: { user_name: string; image_url: string | null } | null }, isOwn: boolean): ChatMessages {
  return {
    id: raw.id,
    senderId: raw.sender_id,
    senderName: raw.users?.user_name ?? raw.sender_id.slice(0, 8),
    senderImage: raw.users?.image_url ?? null,
    content: raw.content,
    createdAt: raw.created_at,
    isOwn,
    isEdited: raw.is_edited ?? false,
  };
}

export default function ChatView() {
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState<ChatMessages[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const oldestMessageDateRef = useRef<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const user = useSelector((s: RootState) => s.userAuth.user);
  const isConnected = useSelector((s: RootState) => s.userAuth.isConnected);
  const { refetchChats } = useChats();
  const { chatId } = useParams();
  const { subscribeToChats, unsubscribeFromChats, send, onMessage } = useWebSocket();
  const prevChatIdRef = useRef<string | null>(null);

  const [deleteModalOpen,setDeleteModalOpen] = useState(false);

  // Subscribe/unsubscribe to chat via WebSocket when chatId changes
  useEffect(() => {
    if (!chatId || !user) return;

    if (prevChatIdRef.current && prevChatIdRef.current !== chatId) {
      unsubscribeFromChats([prevChatIdRef.current]);
    }
    prevChatIdRef.current = chatId;

    subscribeToChats([chatId]);

    return () => {
      if (chatId) {
        unsubscribeFromChats([chatId]);
      }
    };
  }, [chatId, user, subscribeToChats, unsubscribeFromChats]);

  // Fetch initial messages via REST
  useEffect(() => {
    if (!chatId || !user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessagesLoading(true);
    setMessages([]);
    setHasMoreMessages(true);
    setLoadingMore(false);
    oldestMessageDateRef.current = null;
    setStreaming(false);

    fetch(`/api/chats/${chatId}/messages`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch messages");
        return res.json();
      })
      .then((data) => {
        const msgs = data.messages.map((m: { id: string; sender_id: string; content: string; created_at: string; is_edited?: boolean; users?: { user_name: string; image_url: string | null } | null }) =>
          buildMessage(m, m.sender_id === user.id),
        );
        setMessages(msgs);
        setHasMoreMessages(data.hasMore ?? false);
        if (msgs.length > 0) {
          oldestMessageDateRef.current = msgs[0].createdAt;
        }
      })
      .catch((err) => {
        console.error(`[ChatView] failed to fetch messages for chat ${chatId}:`, err);
        setMessages([]);
      })
      .finally(() => setMessagesLoading(false));
  }, [chatId, user]);

  // Listen for real-time messages via WebSocket
  useEffect(() => {
    if (!chatId || !user) return;

    const unsubscribe = onMessage((msg) => {
      if (msg.type === 'message:new' && msg.payload.chatId === chatId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.payload.id)) return prev;
          return [
            ...prev,
            {
              id: msg.payload.id,
              senderId: msg.payload.senderId,
              senderName: msg.payload.senderName,
              senderImage: msg.payload.senderImage ?? null,
              content: msg.payload.content,
              createdAt: msg.payload.createdAt,
              isOwn: msg.payload.senderId === user.id,
            },
          ];
        });
      } else if (msg.type === 'message:ack' && msg.payload.tempId) {
        // Update optimistic message with real ID using tempId match
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.payload.tempId ? { ...m, id: msg.payload.id } : m,
          ),
        );
      }
    });

    return unsubscribe;
  }, [chatId, user, onMessage]);

  async function loadMoreMessages() {
    if (!chatId || loadingMore || !hasMoreMessages || !oldestMessageDateRef.current || !user) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/chats/${chatId}/messages?before=${encodeURIComponent(oldestMessageDateRef.current)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch more messages");
      const data = await res.json();
      const newMsgs = data.messages.map((m: { id: string; sender_id: string; content: string; created_at: string; is_edited?: boolean; users?: { user_name: string; image_url: string | null } | null }) =>
        buildMessage(m, m.sender_id === user.id),
      );
      setMessages((prev) => [...newMsgs, ...prev]);
      setHasMoreMessages(data.hasMore ?? false);
      if (newMsgs.length > 0) {
        oldestMessageDateRef.current = newMsgs[0].createdAt;
      }
    } catch (err) {
      console.error(`[ChatView] failed to load more messages:`, err);
    } finally {
      setLoadingMore(false);
    }
  }

  async function sendMessage() {
    if (!chatId || !messageText.trim() || !user) return;

    const trimmed = messageText.trim();
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessages = {
      id: tempId,
      senderId: user.id,
      content: trimmed,
      createdAt: new Date().toISOString(),
      isOwn: true,
      senderName: user.user_name,
      senderImage: null,
    };

    setMessages((prev) => [...prev, optimistic]);
    setMessageText("");

    if (isConnected) {
      // Send via WebSocket for real-time delivery
      send('message:send', { chatId, content: trimmed, tempId });
    } else {
      // Fallback to REST if WebSocket is disconnected
      try {
        const res = await fetch(`/api/chats/${chatId}/${user.id}/appendMessage`, {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content: trimmed, chatId, userId: user.id }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed to send message" }));
          throw new Error(err.error);
        }

        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, id: data.message.id, createdAt: data.message.created_at }
              : m,
          ),
        );
        refetchChats();
      } catch (err) {
        console.error(`[ChatView] error sending message:`, err);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    }
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
    if (!editingMessageId || !editText.trim() || !chatId) return;

    const newContent = editText.trim();
    const prevMessages = [...messages];

    setMessages((prev) =>
      prev.map((m) =>
        m.id === editingMessageId ? { ...m, content: newContent, isEdited: true } : m,
      ),
    );
    setEditingMessageId(null);
    setEditText("");

    try {
      const res = await fetch(
        `/api/chats/${chatId}/messages/${editingMessageId}/${user?.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: newContent }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update message" }));
        throw new Error(err.error);
      }

      const data = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === editingMessageId ? buildMessage(data.message, true) : m)),
      );
      refetchChats();
    } catch (err) {
      console.error(`[ChatView] error updating message ${editingMessageId}:`, err);
      setMessages(prevMessages);
    }
  }

  function cancelDelete() {
    setDeleteModalOpen(false);
  }

  async function confirmDelete() {
    if (!deletingMessageId || !chatId) return;

    const msgId = deletingMessageId;
    const prevMessages = [...messages];

    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setDeletingMessageId(null);

      setDeleteModalOpen(false);
    try {
      const res = await fetch(
        `/api/chats/${chatId}/messages/${msgId}/${user?.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to delete message" }));
        throw new Error(err.error);
      }

      refetchChats();
    } catch (err) {
      console.error(`[ChatView] error deleting message ${msgId}:`, err);
      setMessages(prevMessages);
    }

  }
  
  if (!user) return null;

  if (!chatId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-surface">
        <div className="h-12 w-12 text-border">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-12 w-12">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h2 className="text-[17px]/[1.4] font-medium text-text-muted">No conversation selected</h2>
        <p className="text-sm text-border-active">
          Pick a conversation from the sidebar or start a new one
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-surface">
      <ChatHeader />
      <MessageList
        messages={messages}
        loading={messagesLoading}
        loadingMore={loadingMore}
        hasMore={hasMoreMessages}
        onLoadMore={loadMoreMessages}
        streaming={streaming}
        editingMessageId={editingMessageId}
        editText={editText}
        onEditTextChange={setEditText}
        onStartEdit={startEdit}
        onSaveEdit={saveEdit}
        onCancelEdit={cancelEdit}
        onDeleteClick={(msgId) => {
        setDeleteModalOpen(prev => !prev);
        setDeletingMessageId(msgId)
        }}
        userId={user.id}
        onAddReaction={(messageId, emoji) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== messageId) return m;
              const existing = m.reactions?.find(
                (r) => r.emoji === emoji && r.userId === user.id,
              );
              if (existing) return m;
              const reaction: Reaction = {
                id: `reaction-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                userId: user.id,
                userName: user.user_name,
                emoji,
                createdAt: new Date().toISOString(),
              };
              return { ...m, reactions: [...(m.reactions ?? []), reaction] };
            }),
          );
        }}
        onRemoveReaction={(messageId, reactionId) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, reactions: m.reactions?.filter((r) => r.id !== reactionId) }
                : m,
            ),
          );
        }}
      />
      <div className="pb-4 pt-2">
        <ChatInput value={messageText} onChange={setMessageText} onSend={sendMessage} />
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete message?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  );
}
