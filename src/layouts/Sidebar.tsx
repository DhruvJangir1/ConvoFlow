import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { resetUnreadNotif } from "../store/userAuthSlice";
import ProfileModal from "../modals/ProfileModal";
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import ChatIcon from '@mui/icons-material/Chat';
import LanguageIcon from '@mui/icons-material/Language';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import UserAvatar from "../components/UserAvatar";

type SidebarProps = {
  onAction?: (action: string) => void;
};

export default function Sidebar({ onAction }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.userAuth.user);
  const unreadCount = useSelector((s: RootState) => s.userAuth.unreadNotifCount);
  const [profileOpen, setProfileOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  const wide = expanded || !!onAction;

  const btnClass = (active: boolean) =>
    `cursor-pointer flex items-center gap-3 rounded-lg transition-colors ${
      wide ? "w-full px-3 py-2" : "h-8 w-8 justify-center"
    } ${
      active
        ? "bg-surface-hover text-text-primary"
        : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
    }`;

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

  return (
    <aside className={`flex shrink-0 flex-col border-r border-border bg-surface-elevated py-3 transition-all duration-200 ${
      wide ? "w-full px-3 items-start" : "w-12 items-center"
    }`}>
      <button
        onClick={() => {
          if (onAction) {
            onAction("sidebar-close");
          } else {
            setExpanded((p) => !p);
          }
        }}
        className={btnClass(false)}
        aria-label={wide ? (onAction ? "Close" : "Collapse") : "Expand sidebar"}
      >
        <ViewSidebarIcon fontSize="small" />
        {wide && <span className="text-sm whitespace-nowrap">{onAction ? "Close" : "Collapse"}</span>}
      </button>

      <button
        onClick={() => handleNav("chats")}
        className={btnClass(isActive("/home"))}
        aria-label="Chats"
      >
        <ChatIcon fontSize="small" />
        {wide && <span className="text-sm whitespace-nowrap">Chats</span>}
      </button>

      <button
        onClick={() => handleNav("communities")}
        className={btnClass(isActive("/communities"))}
        aria-label="Communities"
      >
        <LanguageIcon fontSize="small" />
        {wide && <span className="text-sm whitespace-nowrap">Communities</span>}
      </button>

      <button
        onClick={() => navigate("/notification")}
        className={`relative ${btnClass(isActive("/notification"))}`}
        aria-label="Notifications"
      >
        {unreadCount > 0 && (
          <span className={`${wide ? "" : "absolute -right-0.5 -top-0.5"} flex h-2 w-2`}>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-400" />
          </span>
        )}
        <NotificationsIcon fontSize="small" />
        {wide && <span className="text-sm whitespace-nowrap">Notifications</span>}
      </button>

      <button
        onClick={() => setTimeout(() => setProfileOpen(true), 300)}
        className={`mt-auto ${btnClass(false)}`}
        aria-label="Profile"
      >
        {(user && user.image_url) ? (
          <UserAvatar imageUrl={user.image_url} userName={user.user_name} size="sm" />
        ) : (
          <PersonOutlined fontSize="small" />
        )}
        {wide && <span className="text-sm whitespace-nowrap">Profile</span>}
      </button>

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </aside>
  );
}
