import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { useParams } from "react-router-dom";
import { clerkFetch } from "../lib/clerkFetch";
import ChatHeader from "../components/ChatHeader";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import ConfirmModal from "../modals/ConfirmModal";
import ImageModal from "../modals/ImageModal";
import { useChatMessagesQuery } from "../hooks/useChatMessagesQuery";
import { useEditMessageMutation, useDeleteMessageMutation } from "../hooks/useChatMutations";
import type { ChatMessages } from "../types/chat";

type RawMessage = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_edited?: boolean;
  message_type?: string;
  USERS?: { user_name: string; image_url: string | null } | null;
};

function parseMessage(raw: RawMessage, userId: string, chatId: string): ChatMessages {
  const name = raw.USERS ? raw.USERS.user_name : raw.sender_id.slice(0, 8);
  const image = raw.USERS ? raw.USERS.image_url : null;
  return {
    id: raw.id,
    chatId,
    senderId: raw.sender_id,
    senderName: name,
    senderImage: image,
    content: raw.content,
    createdAt: raw.created_at,
    isOwn: raw.sender_id === userId,
    isEdited: raw.is_edited === true,
    messageType: raw.message_type || "text",
  };
}

export default function ChatView() {
  const user = useSelector((s: RootState) => s.userAuth.user);
  const { chatId } = useParams();

  const editMutation = useEditMessageMutation();
  const deleteMutation = useDeleteMessageMutation();
  const { data: messagesFromServer } = useChatMessagesQuery(chatId);

  const [messages, setMessages] = useState<ChatMessages[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const paginationCursor = useRef<string | null>(null);
  const activeChatRef = useRef<string | null>(null);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!chatId || !messagesFromServer) return;

    const switched = activeChatRef.current !== chatId;
    activeChatRef.current = chatId;

    setMessages((previous) => {
      if (switched) return messagesFromServer.messages;
      const serverIds = new Set(messagesFromServer.messages.map((m) => m.id));
      const oldest = messagesFromServer.messages[0];
      const extras = previous.filter((m) =>
        serverIds.has(m.id) ? false
          : String(m.id).startsWith("temp-") ? true
          : oldest !== undefined && new Date(m.createdAt) < new Date(oldest.createdAt),
      );
      return [...messagesFromServer.messages, ...extras];
    });

    if (switched) {
      setHasOlderMessages(messagesFromServer.hasMore);
      const firstMsg = messagesFromServer.messages[0];
      paginationCursor.current = firstMsg ? firstMsg.createdAt : null;
    }
  }, [messagesFromServer, chatId]);

  async function loadMoreMessages() {
    if (!chatId || !user || isLoadingMore || !hasOlderMessages || !paginationCursor.current) return;

    setIsLoadingMore(true);
    try {
      const url = "/api/chats/" + chatId + "/messages?before=" + encodeURIComponent(paginationCursor.current);
      const response = await clerkFetch(url);
      if (!response.ok) return;

      const data = await response.json();
      const olderMessages: ChatMessages[] = data.messages.map((msg: RawMessage) => parseMessage(msg, user.id, chatId));
      setMessages((previous) => {
        const existingIds = new Set(previous.map((m) => m.id));
        const fresh = olderMessages.filter((m) => !existingIds.has(m.id));
        return fresh.concat(previous);
      });
      setHasOlderMessages(data.hasMore === true);
      if (olderMessages.length > 0) {
        paginationCursor.current = olderMessages[0].createdAt;
      }
    } catch {
      // silently ignore
    } finally {
      setIsLoadingMore(false);
    }
  }

  function startEdit(messageId: string) {
    const message = messages.find((msg) => msg.id === messageId);
    if (!message) return;
    setEditingMessageId(messageId);
    setEditingText(message.content);
  }

  function saveEdit() {
    if (!editingMessageId || !editingText.trim() || !chatId || !user) return;

    setMessages((previous) =>
      previous.map((msg) =>
        msg.id === editingMessageId
          ? { ...msg, content: editingText.trim(), isEdited: true }
          : msg,
      ),
    );
    editMutation.mutate({
      chatId,
      messageId: editingMessageId,
      content: editingText.trim(),
      userId: user.id,
    });
    setEditingMessageId(null);
    setEditingText("");
  }

  function confirmDelete() {
    if (!deletingMessageId || !chatId || !user) return;

    setMessages((previous) => previous.filter((msg) => msg.id !== deletingMessageId));
    deleteMutation.mutate({
      chatId,
      messageId: deletingMessageId,
      userId: user.id,
    });
    setDeletingMessageId(null);
    setShowDeleteModal(false);
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
        <p className="text-sm text-border-active">Pick a conversation from the sidebar or start a new one</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-surface">
      <ChatHeader />
      <MessageList
        messages={messages}
        loading={!messagesFromServer}
        loadingMore={isLoadingMore}
        hasMore={hasOlderMessages}
        onLoadMore={loadMoreMessages}
        streaming={false}
        editingMessageId={editingMessageId}
        editText={editingText}
        onEditTextChange={setEditingText}
        onStartEdit={startEdit}
        onSaveEdit={saveEdit}
        onCancelEdit={() => { setEditingMessageId(null); setEditingText(""); }}
        onDeleteClick={(id) => { setShowDeleteModal(true); setDeletingMessageId(id); }}
        showVoting={false}
        onImageClick={setImagePreviewUrl}
      />
      <div className="safe-area-bottom">
        <div className="pb-2 sm:pb-4 pt-1 sm:pt-2">
          <ChatInput setMessages={setMessages} />
        </div>
      </div>
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete message?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
      <ImageModal
        isOpen={imagePreviewUrl !== null}
        onClose={() => setImagePreviewUrl(null)}
        src={imagePreviewUrl || ""}
      />
    </div>
  );
}
