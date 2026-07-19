import { MessageSquare } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 text-border" strokeWidth={1.5} />
      <h2 className="text-base sm:text-lg font-medium text-text-muted">No conversation selected</h2>
      <p className="text-xs sm:text-sm text-border-active max-w-xs">
        Pick a conversation from the sidebar or start a new one
      </p>
    </div>
  );
}
