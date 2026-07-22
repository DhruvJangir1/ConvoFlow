import { Paperclip, ArrowUp, X } from "lucide-react";
import { useRef, useEffect, useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { useWebSocket } from "../context/WebSocketContext";
import { clerkFetch } from "../lib/clerkFetch";
import { useSendMessageMutation } from "../hooks/useChatMutations";
import type { ChatMessages } from "../types/chat";

type ChatInputProps = {
  setMessages?: Dispatch<SetStateAction<ChatMessages[]>>;
  value?: string;
  onChange?: (value: string) => void;
  onSend?: () => void;
  sendImage?: (file: File) => void;
  onSendImageWithText?: (image: File, text: string) => Promise<void>;
  disabled?: boolean;
  isAnonymous?: boolean;
  onAnonymousToggle?: () => void;
};

export default function ChatInput({ setMessages, value, onChange, onSend, sendImage, onSendImageWithText, disabled }: ChatInputProps) {
  const internal = setMessages !== undefined;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [internalText, setInternalText] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const messageText = internal ? internalText : (value ?? "");
  const setMessageText = internal ? setInternalText : (onChange ?? (() => {}));

  const user = useSelector((s: RootState) => s.userAuth.user);
  const isConnected = useSelector((s: RootState) => s.userAuth.isConnected);
  const { chatId } = useParams();
  const { send } = useWebSocket();
  const sendMessageMutation = useSendMessageMutation();

  const hasContent = messageText.trim().length > 0;
  const canSend = (hasContent || pendingImage) && !disabled && !sending;

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [messageText, resize]);

  useEffect(() => {
    return () => {
      if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    };
  }, [pendingImagePreview]);

  function clearPendingImage() {
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    setPendingImage(null);
    setPendingImagePreview(null);
  }

  async function internalSendImage(file: File) {
    if (!user || !chatId || !setMessages) return;
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
      const data = await res.json();
      if (!data.url) {
        throw new Error("Image upload did not return a URL");
      }
    } catch (err) {
      console.error("[ChatInput] error uploading image:", err);
    }
  }

  async function internalSendMessage() {
    if (!chatId || !messageText.trim() || !user || !setMessages) return;
    const trimmed = messageText.trim();
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessages = {
      id: tempId,
      chatId,
      senderId: user.id,
      content: trimmed,
      createdAt: new Date().toISOString(),
      isOwn: true,
      senderName: user.user_name,
      senderImage: user.image_url ?? null,
      isEdited: false,
      messageType: "text",
    };
    setMessages((prev) => [...prev, optimistic]);
    setInternalText("");
    if (isConnected) {
      send("message:send", { chatId, content: trimmed, tempId });
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
          onError: () => {
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
          },
        },
      );
    }
  }

  async function internalSendImageWithText(file: File, text: string) {
    if (!user || !chatId || !setMessages) return;
    await internalSendImage(file);
    if (text) {
      const trimmed = text;
      const tempId = `temp-${Date.now()}`;
      const optimistic: ChatMessages = {
        id: tempId,
        chatId,
        senderId: user.id,
        content: trimmed,
        createdAt: new Date().toISOString(),
        isOwn: true,
        senderName: user.user_name,
        senderImage: user.image_url ?? null,
        isEdited: false,
        messageType: "text",
      };
      setMessages((prev) => [...prev, optimistic]);
      if (isConnected) {
        send("message:send", { chatId, content: trimmed, tempId });
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
            onError: () => {
              setMessages((prev) => prev.filter((m) => m.id !== tempId));
            },
          },
        );
      }
    }
  }

  async function handleSend() {
    if (pendingImage) {
      const text = messageText.trim();
      setSending(true);
      try {
        if (internal) {
          if (text) {
            await internalSendImageWithText(pendingImage, text);
          } else {
            await internalSendImage(pendingImage);
          }
        } else {
          if (text && onSendImageWithText) {
            await onSendImageWithText(pendingImage, text);
          } else if (sendImage) {
            sendImage(pendingImage);
          }
        }
      } finally {
        setSending(false);
      }
      clearPendingImage();
      setMessageText("");
    } else if (internal) {
      await internalSendMessage();
    } else {
      onSend?.();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && canSend) {
      e.preventDefault();
      handleSend();
    }
    else if (e.key === "Escape") {
      if (pendingImage) {
        clearPendingImage();
      } else if (messageText.length > 0) {
        setMessageText("");
      } else {
        textareaRef.current?.blur();
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (sending) return;

    const imageFile = Array.from(e.clipboardData.files ?? []).find((file) => file.type.startsWith("image/"));
    if (imageFile) {
      e.preventDefault();
      if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
      setPendingImage(imageFile);
      setPendingImagePreview(URL.createObjectURL(imageFile));
      return;
    }

    const imageItem = Array.from(e.clipboardData.items ?? []).find((item) => item.type.startsWith("image/"));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        e.preventDefault();
        if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
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
            className="h-24 w-24 rounded-xl object-cover border border-zinc-700"
          />
          <button
            type="button"
            aria-label="Remove image"
            onClick={clearPendingImage}
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-text-secondary hover:bg-zinc-600 hover:text-text-primary transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5 bg-zinc-900/60 backdrop-blur-md border border-zinc-800/50 rounded-full px-2 py-1.5">
        <button
          aria-label="Attach file"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-white/10 hover:text-text-primary"
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
          placeholder={pendingImage ? "Add a caption..." : "Message..."}
          rows={1}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-[15px]/[1.6] text-text-primary placeholder-text-muted outline-none"
        />

        <button
          aria-label="Send message"
          aria-disabled={!canSend}
          disabled={!canSend}
          onClick={canSend ? handleSend : undefined}
          className="group flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white transition-all duration-150 hover:brightness-110 active:scale-[0.92]"
          style={{
            background: canSend ? "#007AFF" : "transparent",
            opacity: canSend ? 1 : 0.4,
          }}
        >
          <ArrowUp className="h-4 w-4 transition-transform duration-150 group-hover:-translate-y-0.5" />
        </button>
      </div>
    </div>
  );
}
