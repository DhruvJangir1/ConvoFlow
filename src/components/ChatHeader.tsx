import { useState } from "react";
import { Info } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { useParams } from "react-router-dom";
import { useChatDetailQuery } from "../hooks/useChatDetailQuery";
import GroupInfoModal from "./GroupInfoModal";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function hashToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function avatarGradient(name: string): string {
  const hue = hashToHue(name);
  return `linear-gradient(135deg, hsl(${hue}, 60%, 40%), hsl(${(hue + 60) % 360}, 50%, 30%))`;
}

export default function ChatHeader() {
  const user = useSelector((s: RootState) => s.userAuth.user);
  const onlineUsers = useSelector((s: RootState) => s.chat.onlineUsers);
  const { chatId } = useParams();
  const { data: chat } = useChatDetailQuery(chatId);
  const [infoOpen, setInfoOpen] = useState(false);

  if (!chat) return null;

  const otherUserId = user ? chat.members.find((m) => m.id !== user.id)?.id : null;
  const onlineUserIds = chatId ? onlineUsers[chatId] || [] : [];
  const isOtherOnline = otherUserId ? onlineUserIds.includes(otherUserId) : false;

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface-elevated px-5">
      <div className="flex min-w-0 items-center gap-3">
        {chat.avatar_url ? (
          <img src={chat.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        ) : (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ background: avatarGradient(chat.name) }}
          >
            {getInitials(chat.name)}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[17px]/[1.4] font-semibold text-text-primary">
            {chat.name}
          </h1>
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <span
              className={`h-2 w-2 rounded-full ${
                chat.type === 'dm'
                  ? isOtherOnline
                    ? 'bg-accent-success shadow-[0_0_6px_#4ADE8066]'
                    : 'bg-text-muted'
                  : 'bg-accent-success shadow-[0_0_6px_#4ADE8066]'
              }`}
            />
            {chat.type === 'dm'
              ? isOtherOnline ? 'Online' : 'Offline'
              : `${onlineUserIds.length} online`
            }
          </span>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          aria-label="Conversation info"
          onClick={() => setInfoOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:text-text-primary"
        >
          <Info className="h-4 w-4" />
        </button>
      </div>
      <GroupInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} members={chat.members} />
    </header>
  );
}
