import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Loader2, Search, Shield } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { useChats } from "../context/ChatContext";
import { useAnonymousRoomsQuery } from "../hooks/useAnonymousRoomsQuery";
import { formatSmartDate } from "../lib/dateFormat";
import UserSearchModal from "../modals/UserSearchModal";
import AddFriendButton from "../components/AddFriendButton";
import UserAvatar from "../components/UserAvatar";
import { useWebSocket } from "../context/WebSocketContext";

type ChatListProps = Record<string, never>;

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

export default function ChatList(_props: ChatListProps) {
  const chats = useSelector((s: RootState) => s.chat.chats);
  const { loading } = useChats();
  const navigate = useNavigate();
  const location = useLocation();
  const { chatId: activeChatId, id: activeAnonId } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const mode: "chats" | "communities" =
    location.pathname.startsWith("/communities") || location.pathname.startsWith("/anonymous") ? "communities" : "chats";
  const setMode = (m: "chats" | "communities") => {
    navigate(m === "communities" ? "/communities" : "/home");
  };

  const sorted = useMemo(
    () => [...chats].sort((a, b) => b.timestamp - a.timestamp),
    [chats],
  );

  const filtered = useMemo(
    () => sorted.filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [sorted, searchQuery],
  );

  const { data: anonRooms = [] } = useAnonymousRoomsQuery();
  const { subscribeToChats } = useWebSocket();

  useEffect(() => {
    if (anonRooms.length > 0) {
      subscribeToChats(anonRooms.map(r => r.id));
    }
  }, [anonRooms, subscribeToChats]);

  const filteredAnon = useMemo(
    () => anonRooms
      .filter((room) => (room.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.timestamp - a.timestamp),
    [anonRooms, searchQuery],
  );

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const isAnonMode = mode === "communities";

  return (
    <aside className="flex h-full w-full lg:w-65 shrink-0 flex-col border-r border-zinc-800/40 bg-surface-elevated">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <img src="/CONVO_FLOW_LOGO.png" alt="ConvoFlow" className="h-8 w-auto" />
        </div>
        <div className="flex items-center gap-1">
          <AddFriendButton compact />
        </div>
      </div>

      {/* Mode tabs on mobile */}
      <div className="flex border-b border-border px-2 py-1.5 gap-1 lg:hidden">
        <button
          onClick={() => setMode("chats")}
          className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
            mode === "chats"
              ? "bg-surface-hover text-text-primary"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Chats
        </button>
        <button
          onClick={() => setMode("communities")}
          className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
            mode === "communities"
              ? "bg-surface-hover text-text-primary"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Communities
        </button>
      </div>

      <div className="flex flex-col px-3 pt-3 pb-1">
        <div className="flex items-center gap-2 rounded-lg bg-surface-raised border border-border px-3 py-2 transition-colors duration-150 focus-within:border-accent">
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAnonMode ? "Search communities..." : "Search conversations..."}
            aria-label={isAnonMode ? "Search communities" : "Search conversations"}
            className="flex-1 bg-transparent text-[13px] text-text-primary placeholder-text-muted outline-none"
          />
        </div>
      </div>

      <div className="chat-scrollbar flex flex-1 flex-col overflow-y-auto py-2">
        {isAnonMode ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2">
              <Shield className="h-4 w-4 text-accent" />
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">All Communities</span>
            </div>
            {filteredAnon.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <p className="text-sm text-text-muted">{searchQuery ? "No communities match your search." : "No communities yet."}</p>
              </div>
            ) : (
              filteredAnon.map((room) => {
                const isActive = room.id === activeAnonId;
                return (
                  <button
                    key={room.id}
                    onClick={() => handleNavigate(`/anonymous/${room.id}`)}
                    className={`relative mx-2 my-0.5 flex h-16 items-center gap-3 rounded-[10px] px-3 text-left transition-colors duration-120 hover:bg-surface-raised ${
                      isActive ? "bg-white/5" : ""
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-8 bg-accent rounded-r-full shadow-[0_0_8px_#7C6EF766]" />
                    )}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ background: avatarGradient(room.name || room.id) }}
                    >
                      {getInitials(room.name || "AN")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between">
                        <span className="truncate text-[13px]/[1.5] font-medium text-text-primary">
                          {room.name || "Anonymous Room"}
                        </span>
                        {room.timestamp > 0 && (
                          <span className="ml-2 shrink-0 text-[11px]/[1.4] text-text-secondary">
                            {formatSmartDate(room.timestamp)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[11px]/[1.4] text-text-secondary">
                        {room.lastMessage || "Chat anonymously"}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </>
        ) : (
          <>
            <div className="mx-3 mb-1 border-t border-border" />
            {loading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <p className="text-sm text-text-muted">{searchQuery ? "No conversations match your search." : "No conversations yet."}</p>
              </div>
            ) : (
              filtered.map((chat) => {
                const isActive = chat.id === activeChatId;
                return (
                  <button
                    key={chat.id}
                    onClick={() => handleNavigate(`/chat/${chat.id}`)}
                    className={`relative mx-2 my-0.5 flex h-16 items-center gap-3 rounded-[10px] px-3 text-left transition-colors duration-120 hover:bg-surface-raised ${
                      isActive ? "bg-white/5" : ""
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-8 bg-accent rounded-r-full shadow-[0_0_8px_#7C6EF766]" />
                    )}
                    {chat.avatar_url ? (
                      <UserAvatar imageUrl={chat.avatar_url} userName={chat.name} size="md" />
                    ) : (
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                        style={{ background: avatarGradient(chat.name) }}
                      >
                        {getInitials(chat.name)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between">
                        <span className="truncate text-[13px]/[1.5] font-medium text-text-primary">
                          {chat.name}
                        </span>
                        <span className="ml-2 shrink-0 text-[11px]/[1.4] text-text-secondary">
                          {formatSmartDate(chat.timestamp)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between">
                        <span className="truncate text-[11px]/[1.4] text-text-secondary">
                          {chat.lastMessage || "No messages yet"}
                        </span>
                        {chat.unread > 0 && (
                          <span className="ml-2 flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white">
                            {chat.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </>
        )}
      </div>
      <UserSearchModal isOpen={userSearchOpen} onClose={() => setUserSearchOpen(false)} />
    </aside>
  );
}
