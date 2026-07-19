import { Loader2 } from "lucide-react";

interface Props {
  isOpen: boolean;
}

export default function AcceptLoadingModal({ isOpen }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border border-border bg-surface-elevated px-8 py-10 shadow-2xl shadow-black/40">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        <p className="text-sm font-medium text-text-primary">
          Accepting friend request...
        </p>
      </div>
    </div>
  );
}
