import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useOutletContext } from "react-router-dom";
import { Loader2, Search, Bell, User, Menu } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { useChats } from "../context/ChatContext";
import { useAnonymousRoomsQuery } from "../hooks/useAnonymousRoomsQuery";
import { formatSmartDate } from "../lib/dateFormat";
import AddFriendButton from "../components/AddFriendButton";
import UserAvatar from "../components/UserAvatar";
import { useWebSocket } from "../context/WebSocketContext";
import ProfileModal from "../modals/ProfileModal";

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

type RootLayoutCtx = {
  setShowOverlay: (overlay: "sidebar" | null) => void;
};

export default function Home() {
  const { setShowOverlay } = useOutletContext<RootLayoutCtx>();
  const chats = useSelector((s: RootState) => s.chat.chats);
  const { loading } = useChats();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const mode: "chats" | "communities" =
    location.pathname.startsWith("/communities") || location.pathname.startsWith("/anonymous") ? "communities" : "chats";

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
    <div className="flex h-full w-full flex-col bg-surface lg:hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-elevated px-4 py-3">
        <button
          onClick={() => setShowOverlay("sidebar")}
          aria-label="Open navigation"
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
        >
          <Menu className="h-4 w-4" />
        </button>
        <img src="/CONVO_FLOW_LOGO.png" alt="ConvoFlow" className="h-7 mx-2 w-auto" />
        <h1 className="text-[17px] font-semibold text-text-primary">
          {isAnonMode ? "Communities" : "Chats"}
        </h1>
        <div className="flex items-center gap-4">
          <AddFriendButton compact />
          <button
            onClick={() => navigate("/notification")}
            aria-label="Notifications"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            onClick={() => setProfileOpen(true)}
            aria-label="Profile"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
          >
            <User className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex shrink-0 border-b border-border px-4 py-2.5 gap-2">
        <button
          onClick={() => navigate("/home")}
          className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
            mode === "chats"
              ? "bg-accent text-white"
              : "bg-surface-raised text-text-secondary hover:text-text-primary"
          }`}
        >
          Chats
        </button>
        <button
          onClick={() => navigate("/communities")}
          className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
            mode === "communities"
              ? "bg-accent text-white"
              : "bg-surface-raised text-text-secondary hover:text-text-primary"
          }`}
        >
          Communities
        </button>
      </div>

      {/* Search */}
      <div className="shrink-0 px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 rounded-lg bg-surface-raised border border-border px-3 py-2.5 transition-colors duration-150 focus-within:border-accent">
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAnonMode ? "Search communities..." : "Search conversations..."}
            aria-label={isAnonMode ? "Search communities" : "Search conversations"}
            className="flex-1 bg-transparent text-[14px] text-text-primary placeholder-text-muted outline-none"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {isAnonMode ? (
          <>
            {filteredAnon.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <p className="text-sm text-text-muted">{searchQuery ? "No communities match your search." : "No communities yet."}</p>
              </div>
            ) : (
              filteredAnon.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleNavigate(`/anonymous/${room.id}`)}
                  className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised"
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ background: avatarGradient(room.name || room.id) }}
                  >
                    {getInitials(room.name || "AN")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className="truncate text-[14px] font-medium text-text-primary">
                        {room.name || "Anonymous Room"}
                      </span>
                      {room.timestamp > 0 && (
                        <span className="ml-2 shrink-0 text-[11px] text-text-secondary">
                          {formatSmartDate(room.timestamp)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-text-secondary">
                      {room.lastMessage || "Chat anonymously"}
                    </div>
                  </div>
                </button>
              ))
            )}
          </>
        ) : (
          <>
            {loading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <p className="text-sm text-text-muted">{searchQuery ? "No conversations match your search." : "No conversations yet."}</p>
              </div>
            ) : (
              filtered.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => handleNavigate(`/chat/${chat.id}`)}
                  className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised"
                >
                  {chat.avatar_url ? (
                    <UserAvatar imageUrl={chat.avatar_url} userName={chat.name} size="md" />
                  ) : (
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ background: avatarGradient(chat.name) }}
                    >
                      {getInitials(chat.name)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className="truncate text-[14px] font-medium text-text-primary">
                        {chat.name}
                      </span>
                      <span className="ml-2 shrink-0 text-[11px] text-text-secondary">
                        {formatSmartDate(chat.timestamp)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="truncate text-[12px] text-text-secondary">
                        {chat.lastMessage || "No messages yet"}
                      </span>
                      {chat.unread > 0 && (
                        <span className="ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </>
        )}
      </div>

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
