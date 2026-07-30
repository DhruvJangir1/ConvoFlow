import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { resetUnreadNotif } from "../store/userAuthSlice";
import ChatIcon from '@mui/icons-material/Chat';
import LanguageIcon from '@mui/icons-material/Language';
import NotificationsIcon from '@mui/icons-material/Notifications';
import UserSelfProfilePopUp from "../components/UserSelfProfilePopUp";

type SidebarProps = {
  onAction?: (action: string) => void;
};

export default function Sidebar({ onAction }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const unreadCount = useSelector((s: RootState) => s.userAuth.unreadNotifCount);

  useEffect(() => {
    if (location.pathname === '/notification') {
      dispatch(resetUnreadNotif());
    }
  }, [location.pathname, dispatch]);

  const isActive = (path: string) => {
    if (path === "/home" || path === "/chat") {
      return location.pathname === "/home" || location.pathname.startsWith("/chat");
    }
    if (path === "/communities" || path === "/anonymous") {
      return location.pathname === "/communities" || location.pathname.startsWith("/anonymous");
    }
    return location.pathname === path;
  };

  const pathMap: Record<string, string> = {
    chats: "/home",
    communities: "/communities",
  };

  const handleNav = (action: string) => {
    if (onAction) {
      onAction(action);
    } else {
      navigate(pathMap[action] ?? "/home");
    }
  };

  const btnClass = (active: boolean) =>
    `cursor-pointer flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors ${
      active
        ? "bg-surface-hover text-text-primary"
        : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
    }`;

  return (
    <aside className="relative flex w-[4.5rem] shrink-0 flex-col border-r border-border bg-surface-elevated py-3 px-3 items-center">
      {onAction && (
        <button
          onClick={(e) => { e.stopPropagation(); onAction("sidebar-close"); }}
          className={btnClass(false)}
          aria-label="Close"
        >
        </button>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); handleNav("chats"); }}
        className={btnClass(isActive("/home"))}
        aria-label="Chats"
      >
        <ChatIcon fontSize="medium" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); handleNav("communities"); }}
        className={btnClass(isActive("/communities"))}
        aria-label="Communities"
      >
        <LanguageIcon fontSize="medium" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); navigate("/notification"); }}
        className={`relative ${btnClass(isActive("/notification"))}`}
        aria-label="Notifications"
      >
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-400" />
          </span>
        )}
        <NotificationsIcon fontSize="medium" />
      </button>

      {!onAction && (
        <div className="mt-auto">
          <UserSelfProfilePopUp />
        </div>
      )}
    </aside>
  );
}
