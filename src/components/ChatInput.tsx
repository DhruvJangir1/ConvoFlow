import { Paperclip, ArrowUp } from "lucide-react";
import { useRef, useEffect, useCallback } from "react";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  isAnonymous?: boolean;
  onAnonymousToggle?: () => void;
};

export default function ChatInput({ value, onChange, onSend, disabled, isAnonymous, onAnonymousToggle }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasContent = value.trim().length > 0;
  const canSend = hasContent && !disabled;

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && canSend) {
      e.preventDefault();
       onSend();
    }
    else if (e.key === "Escape") {
      if (value.length > 0) {
        onChange("");
      } else {
        textareaRef.current?.blur();
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[95%] items-center gap-1.5 bg-zinc-900/60 backdrop-blur-md border border-zinc-800/50 rounded-full px-2 py-1.5">
      <button
        aria-label="Attach file"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-white/10 hover:text-text-primary"
      >
        <Paperclip className="h-4 w-4" />
      </button>

      {onAnonymousToggle !== undefined && (
        <label className="flex cursor-pointer items-center gap-1.5 select-none">
          <div
            role="switch"
            aria-checked={isAnonymous}
            tabIndex={0}
            onClick={onAnonymousToggle}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAnonymousToggle(); }}}
            className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${isAnonymous ? 'bg-[#007AFF]' : 'bg-zinc-700'}`}
          >
            <div
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${isAnonymous ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
            />
          </div>
          <span className="text-[11px] font-medium text-text-muted">Anonymous</span>
        </label>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) =>onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Message input"
        aria-multiline="true"
        placeholder="Message..."
        rows={1}
        className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-[15px]/[1.6] text-text-primary placeholder-text-muted outline-none"
      />

      <button
        aria-label="Send message"
        aria-disabled={!canSend}
        disabled={!canSend}
        onClick={canSend ? onSend : undefined}
        className="group flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white transition-all duration-150 hover:brightness-110 active:scale-[0.92]"
        style={{
          background: canSend ? "#007AFF" : "transparent",
          opacity: canSend ? 1 : 0.4,
        }}
      >
        <ArrowUp className="h-4 w-4 transition-transform duration-150 group-hover:-translate-y-0.5" />
      </button>
    </div>
  );
}
