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
import type { ChatMessages, MessageCursor } from "../types/chat";

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

function insertMessageChronologically(messages: ChatMessages[], entry: ChatMessages): ChatMessages[] {
  const withoutEntry = messages.filter((message) => message.id !== entry.id);
  const entryTime = new Date(entry.createdAt).getTime();
  const insertionIndex = withoutEntry.findIndex((message) => {
    const messageTime = new Date(message.createdAt).getTime();
    return entryTime < messageTime || (entryTime === messageTime && entry.id.localeCompare(message.id) < 0);
  });

  if (insertionIndex === -1) return [...withoutEntry, entry];
  return [...withoutEntry.slice(0, insertionIndex), entry, ...withoutEntry.slice(insertionIndex)];
}

function mergeMessages(previous: ChatMessages[], server: ChatMessages[]): ChatMessages[] {
  return server.reduce((messages, message) => insertMessageChronologically(messages, message), previous);
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
  const paginationCursor = useRef<MessageCursor | null>(null);
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
      return mergeMessages(previous, messagesFromServer.messages);
    });

    if (switched) {
      setHasOlderMessages(messagesFromServer.hasMore);
      paginationCursor.current = messagesFromServer.nextCursor;
    }
  }, [messagesFromServer, chatId]);

  async function loadMoreMessages() {
    if (!chatId || !user || isLoadingMore || !hasOlderMessages || !paginationCursor.current) return;

    setIsLoadingMore(true);
    try {
    const cursor = paginationCursor.current;
    if (!cursor) return;
    const url = "/api/chats/" + chatId + "/messages?beforeCreatedAt=" + encodeURIComponent(cursor.beforeCreatedAt) + "&beforeId=" + encodeURIComponent(cursor.beforeId);
      const response = await clerkFetch(url);
      if (!response.ok) return;

      const data = await response.json() as { messages: RawMessage[]; hasMore: boolean; nextCursor: MessageCursor | null };
      const olderMessages: ChatMessages[] = data.messages.map((msg: RawMessage) => parseMessage(msg, user.id, chatId));
      setMessages((previous) => {
        const existingIds = new Set(previous.map((m) => m.id));
        const fresh = olderMessages.filter((m) => !existingIds.has(m.id));
        return fresh.concat(previous);
      });
      setHasOlderMessages(data.hasMore === true);
      paginationCursor.current = data.nextCursor;
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
