import { MessageSquare } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-surface">
      <MessageSquare className="h-12 w-12 text-border" strokeWidth={1.5} />
      <h2 className="text-lg font-medium text-text-muted">No conversation selected</h2>
      <p className="text-sm text-border-active">
        Pick a conversation from the sidebar or start a new one
      </p>
    </div>
  );
}
