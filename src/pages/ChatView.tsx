import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { useWebSocket } from "../context/WebSocketContext";
import { useParams } from "react-router-dom";
import ChatHeader from "../components/ChatHeader";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import ConfirmModal from "../modals/ConfirmModal";
import { useChatMessagesQuery } from "../hooks/useChatMessagesQuery";
import {
  useSendMessageMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
} from "../hooks/useChatMutations";
import type { ChatMessages } from "../types/chat";
function buildMessage(raw: { id: string; sender_id: string; content: string; created_at: string; is_edited?: boolean; USERS?: { user_name: string; image_url: string | null } | null }, isOwn: boolean): ChatMessages {
  return {
    id: raw.id,
    senderId: raw.sender_id,
    senderName: raw.USERS?.user_name ?? raw.sender_id.slice(0, 8),
    senderImage: raw.USERS?.image_url ?? null,
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
  const { chatId } = useParams();
  const sendMessageMutation = useSendMessageMutation();
  const editMessageMutation = useEditMessageMutation();
  const deleteMessageMutation = useDeleteMessageMutation();
  const { subscribeToChats, send, onMessage } = useWebSocket();
  const prevChatIdRef = useRef<string | null>(null);

  const [deleteModalOpen,setDeleteModalOpen] = useState(false);

  const {
    data: messagesData,
  } = useChatMessagesQuery(chatId);

  // Subscribe/unsubscribe to chat via WebSocket when chatId changes
  useEffect(() => {
    if (!chatId || !user) return;
    prevChatIdRef.current = chatId;
    subscribeToChats([chatId]);
  }, [chatId, user, subscribeToChats]);

  // Seed local state from TanStack cache (instant if cached, otherwise after fetch)
  useEffect(() => {
    if (!chatId) return;

    if (messagesData) {
      setMessages(messagesData.messages);
      setHasMoreMessages(messagesData.hasMore);
      setMessagesLoading(false);
      if (messagesData.messages.length > 0) {
        oldestMessageDateRef.current = messagesData.messages[0].createdAt;
      }
    } else {
      setMessagesLoading(true);
      setMessages([]);
      setHasMoreMessages(true);
      oldestMessageDateRef.current = null;
      setStreaming(false);
    }
  }, [messagesData, chatId]);

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
      const newMsgs = data.messages.map((m: { id: string; sender_id: string; content: string; created_at: string; is_edited?: boolean; USERS?: { user_name: string; image_url: string | null } | null }) =>
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
      senderImage: user.image_url ?? null,
    };

    setMessages((prev) => [...prev, optimistic]);
    setMessageText("");

    if (isConnected) {
      send('message:send', { chatId, content: trimmed, tempId });
    } else {
      sendMessageMutation.mutate(
        { chatId, content: trimmed, userId: user.id },
        {
          onSuccess: (data) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId
                  ? { ...m, id: data.message.id, createdAt: data.message.created_at }
                  : m,
              ),
            );
          },
          onError: (err) => {
            console.error(`[ChatView] error sending message:`, err);
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
          },
        },
      );
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

    editMessageMutation.mutate(
      { chatId, messageId: editingMessageId, content: newContent, userId: user!.id },
      {
        onSuccess: (data) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === editingMessageId ? buildMessage(data.message, true) : m)),
          );
        },
        onError: (err) => {
          console.error(`[ChatView] error updating message ${editingMessageId}:`, err);
          setMessages(prevMessages);
        },
      },
    );
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
    deleteMessageMutation.mutate(
      { chatId, messageId: msgId, userId: user!.id },
      {
        onError: (err) => {
          console.error(`[ChatView] error deleting message ${msgId}:`, err);
          setMessages(prevMessages);
        },
      },
    );

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
          setDeletingMessageId(msgId);
        } }
        showVoting={false} />
        
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
