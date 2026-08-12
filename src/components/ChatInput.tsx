import { Paperclip, ArrowUp, X } from "lucide-react";
import { useRef, useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { clerkFetch } from "../lib/clerkFetch";
import { useWebSocket } from "../context/WebSocketContext";
import type { ChatMessages } from "../types/chat";

type ChatInputProps = {
  setMessages: Dispatch<SetStateAction<ChatMessages[]>>;
};

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

export default function ChatInput({ setMessages }: ChatInputProps) {
  const user = useSelector((s: RootState) => s.userAuth.user);
  const { chatId } = useParams();
  const { send, onMessage } = useWebSocket();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [messageText, setMessageText] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = onMessage((msg) => {
      if (msg.type === "message:ack" && msg.payload.tempId) {
        setMessages((prev) => {
          const optimistic = prev.find((message) => message.id === msg.payload.tempId);
          if (!optimistic) return prev;
          return insertMessageChronologically(
            prev.filter((message) => message.id !== msg.payload.tempId),
            { ...optimistic, id: msg.payload.id, createdAt: msg.payload.createdAt },
          );
        });
      }
    });
    return unsub;
  }, [onMessage, setMessages]);

  const hasContent = messageText.trim().length > 0;
  const canSend = (hasContent || pendingImage !== null) && !sending;

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  useEffect(() => {
    resizeTextarea();
  }, [messageText]);

  function clearPendingImage() {
    if (pendingImagePreview) {
      URL.revokeObjectURL(pendingImagePreview);
    }
    setPendingImage(null);
    setPendingImagePreview(null);
  }

  async function uploadImage(file: File) {
    if (!user || !chatId) return;
    const formData = new FormData();
    formData.append("image", file, file.name);
    try {
      const res = await clerkFetch(`/api/chats/${chatId}/image`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to upload image" }));
        throw new Error(err.error);
      }
    } catch {
      // image upload failed silently
    }
  }

  async function sendTextMessage() {
    if (!chatId || !messageText.trim() || !user) return;
    const trimmed = messageText.trim();
    const tempId = "temp-" + Date.now();
    const optimistic: ChatMessages = {
      id: tempId,
      chatId,
      senderId: user.id,
      content: trimmed,
      createdAt: new Date().toISOString(),
      isOwn: true,
      senderName: user.user_name,
      senderImage: user.image_url || null,
      isEdited: false,
      messageType: "text",
    };
    setMessages((prev) => [...prev, optimistic]);
    setMessageText("");

    const sent = send("message:send", { chatId, content: trimmed, sentAt: Date.now(), tempId });
    if (sent) return;

    try {
      const res = await clerkFetch(`/api/chats/${chatId}/${user.id}/appendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, chatId, userId: user.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message && data.message.id) {
          setMessages((prev) => {
            const optimistic = prev.find((message) => message.id === tempId);
            if (!optimistic) return prev;
            return insertMessageChronologically(
              prev.filter((message) => message.id !== tempId),
              { ...optimistic, id: data.message.id, createdAt: data.message.created_at },
            );
          });
        }
      }
    } catch {
      // REST fallback failed — message stays as pending in local state
    }
  }

  async function handleSend() {
    if (pendingImage !== null) {
      setSending(true);
      try {
        await uploadImage(pendingImage);
        if (messageText.trim()) {
          await sendTextMessage();
        }
      } finally {
        setSending(false);
      }
      clearPendingImage();
      setMessageText("");
    } else {
      await sendTextMessage();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && canSend) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      if (pendingImage !== null) {
        clearPendingImage();
      } else if (messageText.length > 0) {
        setMessageText("");
      } else {
        const el = textareaRef.current;
        if (el) el.blur();
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (sending) return;

    const items = e.clipboardData.items || [];
    const files = e.clipboardData.files || [];

    const imageFile = Array.from(files).find((file) => file.type.startsWith("image/"));
    if (imageFile) {
      e.preventDefault();
      if (pendingImagePreview) {
        URL.revokeObjectURL(pendingImagePreview);
      }
      setPendingImage(imageFile);
      setPendingImagePreview(URL.createObjectURL(imageFile));
      return;
    }

    const imageItem = Array.from(items).find((item) => item.type.startsWith("image/"));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        e.preventDefault();
        if (pendingImagePreview) {
          URL.revokeObjectURL(pendingImagePreview);
        }
        setPendingImage(file);
        setPendingImagePreview(URL.createObjectURL(file));
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[98%] sm:max-w-[95%] md:max-w-[90%] flex-col gap-1.5">
      {pendingImagePreview && (
        <div className="relative w-fit">
          <img
            src={pendingImagePreview}
            alt="Preview"
            className="h-24 w-24 rounded-xl object-cover border border-border"
          />
          <button
            type="button"
            aria-label="Remove image"
            onClick={clearPendingImage}
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface-raised text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5 bg-surface-elevated/60 backdrop-blur-md border border-border rounded-full px-2 py-1.5 transition-all duration-300 focus-within:border-accent/30 focus-within:shadow-[0_0_12px_rgba(29,78,216,0.08)]">
        <button
          aria-label="Attach file"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary"
        >
          <Paperclip className="h-4 w-4" />
        </button>

        <textarea
          ref={textareaRef}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          aria-label="Message input"
          aria-multiline="true"
          placeholder={pendingImage !== null ? "Add a caption..." : "Message..."}
          rows={1}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-[15px]/[1.6] text-text-primary placeholder-text-muted outline-none"
        />

        <button
          aria-label="Send message"
          aria-disabled={!canSend}
          disabled={!canSend}
          onClick={canSend ? handleSend : undefined}
          className="group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-surface-base transition-all duration-150 hover:brightness-110 active:scale-[0.92]"
          style={{
            background: canSend ? "var(--color-accent)" : "transparent",
            opacity: canSend ? 1 : 0.4,
            boxShadow: canSend ? "var(--glow-sm)" : "none",
          }}
        >
          <ArrowUp className="h-4 w-4 transition-transform duration-150 group-hover:-translate-y-0.5" />
        </button>
      </div>
    </div>
  );
}
