import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AnonymousChatHeaderProps {
  roomName: string;
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function hashToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

function avatarGradient(name: string): string {
  const hue = hashToHue(name);
  return `linear-gradient(135deg, hsl(${hue}, 60%, 40%), hsl(${(hue + 60) % 360}, 50%, 30%))`;
}

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
