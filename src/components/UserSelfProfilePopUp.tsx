import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import type { RootState } from "../store/store";
import UserAvatar from "./UserAvatar";

export default function UserSelfProfilePopUp() {
  const navigate = useNavigate();
  const user = useSelector((s: RootState) => s.userAuth.user);
  const unreadCount = useSelector((s: RootState) => s.userAuth.unreadNotifCount);

  if (!user) return null;

  return (
    <button
      onClick={() => navigate("/profile")}
      className="group absolute bottom-2 left-2 flex w-[calc(4.5rem+15rem)] items-center gap-2.5 rounded-full bg-surface-elevated px-2 py-1.5 transition-opacity duration-200 hover:opacity-60"
      style={{ filter: "brightness(1.5)" }}
    >
      <div className="shrink-0">
        <UserAvatar imageUrl={user.image_url} userName={user.user_name} size="md" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-[13px] font-medium leading-tight text-text-primary">
          {user.user_name}
        </p>
        <p className="truncate text-[11px] leading-tight text-text-muted">
          {user.bio || "insert bio here"}
        </p>
      </div>
      <div className="relative mr-1 shrink-0">
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-400" />
          </span>
        )}
        <Bell className="h-4 w-4 text-text-muted" />
      </div>
    </button>
  );
}
