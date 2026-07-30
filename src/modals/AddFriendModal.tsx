import { Loader2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  senderName: string;
}

import { getInitials, avatarGradient } from "../lib/avatar";

export default function AddFriendModal({ isOpen, senderName }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-2xl border border-border bg-surface-elevated px-8 py-10 shadow-2xl shadow-black/40">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white"
          style={{ background: avatarGradient(senderName) }}
        >
          {getInitials(senderName)}
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium text-text-primary">
            Adding <span className="font-semibold text-emerald-400">{senderName}</span>
          </p>
          <p className="text-xs text-text-muted">Creating your conversation...</p>
        </div>

        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
      </div>
    </div>
  );
}
