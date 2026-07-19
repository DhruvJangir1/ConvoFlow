import { useState, useCallback, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import ChatList from "./ChatList";
import Sidebar from "./Sidebar";
import { ChatProvider } from "../context/ChatContext";
import { WebSocketProvider } from "../context/WebSocketContext";
import ProfileModal from "../modals/ProfileModal";

type RootLayoutContext = {
  setShowOverlay: (overlay: "sidebar" | null) => void;
  setProfileOpen: (open: boolean) => void;
};

export default function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showOverlay, setShowOverlay] = useState<"sidebar" | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const closeOverlay = useCallback(() => setShowOverlay(null), []);

  useEffect(() => {
    closeOverlay();
  }, [location.pathname, closeOverlay]);

  const handleSidebarAction = useCallback((action: string) => {
    if (action === "chats") {
      setShowOverlay(null);
      navigate("/home");
    } else if (action === "communities") {
      setShowOverlay(null);
      navigate("/communities");
    } else if (action === "sidebar-close") {
      setShowOverlay(null);
    }
  }, [navigate]);

  return (
    <WebSocketProvider>
      <ChatProvider>
        <div className="flex h-dvh overflow-hidden">
          {/* Sidebar - hidden on mobile, inline on md+ */}
          <div className="hidden md:flex">
            <Sidebar />
          </div>

          {/* ChatList - desktop only (lg+); mobile Home page has its own list */}
          <div className="hidden lg:flex">
            <ChatList />
          </div>

          {/* Mobile overlay: Sidebar only */}
          {showOverlay === "sidebar" && (
            <>
              <div className="fixed inset-0 z-40 bg-black/60" onClick={closeOverlay} />
              <div className="fixed inset-y-0 left-0 z-50 animate-slide-in-left w-65">
                <Sidebar onAction={handleSidebarAction} />
              </div>
            </>
          )}

          {/* Right column: main content */}
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="flex flex-1 min-h-0">
              <div className="flex flex-1">
                <Outlet context={{ setShowOverlay, setProfileOpen } satisfies RootLayoutContext} />
              </div>
            </main>
          </div>
        </div>
        <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      </ChatProvider>
    </WebSocketProvider>
  );
}
