import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { setUnreadNotifCount, resetUnreadNotif } from "../store/userAuthSlice";
import ProfileModal from "../modals/ProfileModal";
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import ChatIcon from '@mui/icons-material/Chat';
import LanguageIcon from '@mui/icons-material/Language';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonOutlined from "@mui/icons-material/PersonOutlined";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.userAuth.user);
  const unreadCount = useSelector((s: RootState) => s.userAuth.unreadNotifCount);
  const [profileOpen, setProfileOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const refreshUnread = useCallback(() => {
    if (!user || location.pathname === '/notification') return;
    fetch('/api/notifications?unread=true', { credentials: 'include' })
      .then(res => res.json())
      .then(data => dispatch(setUnreadNotifCount(data.notifications?.length ?? 0)))
      .catch(() => {});
  }, [user, location.pathname, dispatch]);

  useEffect(() => { refreshUnread(); }, [refreshUnread]);

  useEffect(() => {
    const interval = setInterval(refreshUnread, 15_000);
    return () => clearInterval(interval);
  }, [refreshUnread]);

  useEffect(() => {
    const onFocus = () => refreshUnread();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshUnread]);

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

  const btnClass = (active: boolean) =>
    `cursor-pointer flex items-center gap-3 rounded-lg transition-colors ${
      expanded ? "w-full px-3 py-2" : "h-8 w-8 justify-center"
    } ${
      active
        ? "bg-surface-hover text-text-primary"
        : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
    }`;

  return (
    <aside className={`flex shrink-0 flex-col border-r border-border bg-surface-elevated py-3 transition-all duration-200 ${
      expanded ? "w-44 px-2 items-start" : "w-12 items-center"
    }`}>
      <button
        onClick={() => setExpanded((p) => !p)}
        className={btnClass(false)}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
      >
        <ViewSidebarIcon fontSize="small" />
        {expanded && <span className="text-sm whitespace-nowrap">Collapse</span>}
      </button>

      <button
        onClick={() => navigate("/home")}
        className={btnClass(isActive("/home"))}
        aria-label="Chats"
      >
        <ChatIcon fontSize="small" />
        {expanded && <span className="text-sm whitespace-nowrap">Chats</span>}
      </button>

      <button
        onClick={() => navigate("/communities")}
        className={btnClass(isActive("/communities"))}
        aria-label="Communities"
      >
        <LanguageIcon fontSize="small" />
        {expanded && <span className="text-sm whitespace-nowrap">Communities</span>}
      </button>

      <button
        onClick={() => navigate("/notification")}
        className={`relative ${btnClass(isActive("/notification"))}`}
        aria-label="Notifications"
      >
        {unreadCount > 0 && (
          <span className={`${expanded ? "" : "absolute -right-0.5 -top-0.5"} flex h-2 w-2`}>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-400" />
          </span>
        )}
        <NotificationsIcon fontSize="small" />
        {expanded && <span className="text-sm whitespace-nowrap">Notifications</span>}
      </button>

      <button
        onClick={() => setTimeout(() => setProfileOpen(true), 300)}
        className={`mt-auto ${btnClass(false)}`}
        aria-label="Profile"
      >
        {(user && user.image_url)  ? (
          <img src={user.image_url} alt="Profile" className="h-6 w-6 rounded-full" />
        ) : (
          <PersonOutlined fontSize="small" />
        )}
        {expanded && <span className="text-sm whitespace-nowrap">Profile</span>}
      </button>

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </aside>
  );
}
