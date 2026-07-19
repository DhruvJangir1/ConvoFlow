import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, User, Menu } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { useAnonymousRoomsQuery } from "../hooks/useAnonymousRoomsQuery";
import { formatSmartDate } from "../lib/dateFormat";
import { useWebSocket } from "../context/WebSocketContext";
import AddFriendButton from "../components/AddFriendButton";
import ProfileModal from "../modals/ProfileModal";

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

type RootLayoutCtx = {
  setShowOverlay: (overlay: "sidebar" | null) => void;
};

export default function Communities() {
  const navigate = useNavigate();
  const { setShowOverlay } = useOutletContext<RootLayoutCtx>();
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
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
        <h1 className="text-[17px] font-semibold text-text-primary">Communities</h1>
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
          className="flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors bg-surface-raised text-text-secondary hover:text-text-primary"
        >
          Chats
        </button>
        <button
          className="flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors bg-accent text-white"
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
            placeholder="Search communities..."
            aria-label="Search communities"
            className="flex-1 bg-transparent text-[14px] text-text-primary placeholder-text-muted outline-none"
          />
        </div>
      </div>

      {/* Community list */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {filteredAnon.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="text-sm text-text-muted">{searchQuery ? "No communities match your search." : "No communities yet."}</p>
          </div>
        ) : (
          filteredAnon.map((room) => (
            <button
              key={room.id}
              onClick={() => navigate(`/anonymous/${room.id}`)}
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
      </div>

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
