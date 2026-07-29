import { ArrowUp, X } from "lucide-react";
import { useRef, useEffect, useCallback, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import UserAvatar from "../../components/UserAvatar";

type AnonymousChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isAnonymous: boolean;
  onAnonymousToggle: () => void;
};

export default function AnonymousChatInput({
  value,
  onChange,
  onSend,
  isAnonymous,
  onAnonymousToggle,
}: AnonymousChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const user = useSelector((s: RootState) => s.userAuth.user);

  const hasContent = value.trim().length > 0;
  const canSend = (hasContent || pendingImage) && !sending;

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => { resize(); }, [value, resize]);

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

  async function handleSend() {
    if (sending || !canSend) return;
    if (pendingImage) {
      setSending(true);
      try {
        onSend();
      } finally {
        setSending(false);
      }
      clearPendingImage();
    } else {
      onSend();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && canSend) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      if (pendingImage) {
        clearPendingImage();
      } else if (value.length > 0) {
        onChange("");
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
    <div className="mx-auto flex w-full max-w-[98%] sm:max-w-[95%] md:max-w-[90%] flex-col gap-1.5 pb-2 sm:pb-4 pt-1 sm:pt-2">
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

      <div
        className={`flex items-center gap-1.5 backdrop-blur-md border rounded-full px-2 py-1.5 transition-all duration-300 focus-within:border-accent/30 focus-within:shadow-[0_0_12px_rgba(29,78,216,0.08)] ${
          isAnonymous
            ? "bg-accent-muted/40 border-accent-strong/30"
            : "bg-surface-elevated/60 border-border"
        }`}
      >
        <div className="flex shrink-0 items-center gap-2 pl-1">
          <button
            type="button"
            onClick={onAnonymousToggle}
            aria-label={isAnonymous ? "Switch to identified mode" : "Switch to anonymous mode"}
            className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out"
            style={{
              backgroundColor: isAnonymous ? 'var(--color-accent)' : 'var(--color-border-active)',
            }}
          >
            <span
              className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out"
              style={{
                transform: isAnonymous ? 'translateX(18px)' : 'translateX(2px)',
              }}
            />
          </button>

          {isAnonymous ? (
            <span className="text-[12px] font-medium leading-none text-accent-tertiary whitespace-nowrap">Anonymous</span>
          ) : user ? (
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 shrink-0">
                <UserAvatar imageUrl={user.image_url ?? null} userName={user.user_name} size="sm" />
              </div>
              <span className="text-[12px] font-medium leading-none max-w-[80px] truncate text-text-primary">
                {user.user_name}
              </span>
            </div>
          ) : null}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          aria-label="Message input"
          aria-multiline="true"
          placeholder={pendingImage ? "Add a caption..." : "Message..."}
          rows={1}
          className={`max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-[15px]/[1.6] placeholder-text-muted outline-none ${
            isAnonymous ? "text-accent-tertiary" : "text-text-primary"
          }`}
        />

        <button
          aria-label="Send message"
          aria-disabled={!canSend}
          disabled={!canSend}
          onClick={canSend ? handleSend : undefined}
          className="group flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-surface-base transition-all duration-150 hover:brightness-110 active:scale-[0.92]"
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
