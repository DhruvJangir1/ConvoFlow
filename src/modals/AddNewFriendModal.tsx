import { useState, useRef, useEffect } from "react";
import { UserPlus, X, CheckCircle, AlertCircle } from "lucide-react";
import { useSendFriendRequestMutation } from "../hooks/useNotificationMutations";

type AddNewFriendModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type SendStatus = "idle" | "sending" | "success" | "error";

export default function AddNewFriendModal({ isOpen, onClose }: AddNewFriendModalProps) {
  const [userTag, setUserTag] = useState("");
  const [status, setStatus] = useState<SendStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const sendMutation = useSendFriendRequestMutation();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setUserTag("");
      setStatus("idle");
      setErrorMessage("");
    }
  }, [isOpen]);

  const handleSend = async () => {
    const tag = userTag.trim();
    if (!tag || status === "sending") return;

    setStatus("sending");
    setErrorMessage("");

    try {
      await sendMutation.mutateAsync(tag);
      setStatus("success");
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to send request");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[8vh] sm:pt-[15vh] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm mx-2 sm:mx-0 rounded-2xl border border-border bg-surface-elevated shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-accent" />
            <h2 className="text-[15px] sm:text-[17px] font-semibold text-text-primary">Add Friend</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <label htmlFor="userTag" className="mb-1.5 block text-[13px] font-medium text-text-secondary">
            Enter their user tag
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2.5 transition-colors duration-150 focus-within:border-accent">
            <span className="text-sm text-text-muted select-none">@</span>
            <input
              ref={inputRef}
              id="userTag"
              value={userTag}
              onChange={(e) => setUserTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder="username#0000"
              aria-label="User tag"
              className="flex-1 bg-transparent text-[16px] sm:text-[14px] text-text-primary placeholder-text-muted outline-none"
            />
          </div>

          <p className="mt-4 text-xs italic leading-relaxed text-text-muted font-medium">
            Can't find your user tag? Check your profile page. Share your user tag with friends to start connecting!
          </p>

          {status === "success" ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-accent-success/10 px-3 py-2.5 text-sm text-accent-success">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Friend request sent!
            </div>
          ) : status === "error" ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-accent-danger/10 px-3 py-2.5 text-sm text-accent-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              disabled={status === "sending"}
              className="cursor-pointer rounded-lg px-3.5 py-2 text-[13px] font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!userTag.trim() || status === "sending" || status === "success"}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "sending" ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : status === "success" ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              {status === "sending" ? "Sending..." : status === "success" ? "Request Sent" : "Send Request"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
