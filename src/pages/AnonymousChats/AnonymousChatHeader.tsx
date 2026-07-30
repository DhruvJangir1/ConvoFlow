import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AnonymousChatHeaderProps {
  roomName: string;
}

import { getInitials, avatarGradient } from "../../lib/avatar";

export default function AnonymousChatHeader({ roomName }: AnonymousChatHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="flex h-14 sm:h-16 shrink-0 items-center gap-2 sm:gap-3 border-b border-border bg-surface-elevated px-3 sm:px-5">
      <button
        onClick={() => navigate("/home")}
        aria-label="Back to conversations"
        className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors lg:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
        style={{ background: avatarGradient(roomName) }}
      >
        {getInitials(roomName)}
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-[17px]/[1.4] font-semibold text-text-primary">{roomName}</h1>
      </div>
    </header>
  );
}
