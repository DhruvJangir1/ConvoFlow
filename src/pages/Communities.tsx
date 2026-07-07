import { Shield } from "lucide-react";

export default function Communities() {
  return (
    <div className="flex flex-1 flex-col bg-surface">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface-elevated px-5">
        <Shield className="h-5 w-5 text-accent" />
        <h1 className="text-[17px]/[1.4] font-semibold text-text-primary">Communities</h1>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <Shield className="h-12 w-12 text-border" strokeWidth={1.5} />
        <div className="space-y-1">
          <p className="text-sm text-text-muted">Select a community to start chatting</p>
          <p className="text-sm text-text-muted">Post anonymously using the toggle button</p>
          <p className="text-sm text-text-muted">Your identity stays hidden from others</p>
        </div>
      </div>
    </div>
  );
}
