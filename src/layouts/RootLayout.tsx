import { useState, useCallback, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import ChatList from "./ChatList";
import Sidebar from "./Sidebar";
import { ChatProvider } from "../context/ChatContext";
import { WebSocketProvider } from "../context/WebSocketContext";
import { Menu } from "lucide-react";

export default function RootLayout() {
  const location = useLocation();
  const [showOverlay, setShowOverlay] = useState<"sidebar" | "chatlist" | null>(null);
  const [chatlistMode, setChatlistMode] = useState<"chats" | "communities">("chats");
  const closeOverlay = useCallback(() => setShowOverlay(null), []);

  useEffect(() => {
    closeOverlay();
  }, [location.pathname, closeOverlay]);

  const handleSidebarAction = useCallback((action: string) => {
    setShowOverlay(null);
    if (action === "chats") {
      setChatlistMode("chats");
      setShowOverlay("chatlist");
    } else if (action === "communities") {
      setChatlistMode("communities");
      setShowOverlay("chatlist");
    } else if (action === "sidebar-toggle") {
      setShowOverlay("sidebar");
    }
  }, []);

  return (
    <WebSocketProvider>
      <ChatProvider>
        <div className="flex h-dvh overflow-hidden">
          {/* Sidebar - hidden on mobile, inline on md+ */}
          <div className="hidden md:flex">
            <Sidebar onAction={handleSidebarAction} />
          </div>

          {/* ChatList - hidden on mobile, inline on lg+ */}
          <div className="hidden lg:flex">
            <ChatList />
          </div>

          {/* Mobile overlay: Sidebar */}
          {showOverlay === "sidebar" && (
            <>
              <div className="fixed inset-0 z-40 bg-black/60" onClick={closeOverlay} />
              <div className="fixed inset-y-0 left-0 z-50 animate-slide-in-left">
                <Sidebar onAction={handleSidebarAction} />
              </div>
            </>
          )}

          {/* Mobile overlay: ChatList */}
          {showOverlay === "chatlist" && (
            <>
              <div className="fixed inset-0 z-40 bg-black/60" onClick={closeOverlay} />
              <div className="fixed inset-y-0 left-0 z-50 animate-slide-in-left">
                <ChatList onClose={closeOverlay} initialMode={chatlistMode} />
              </div>
            </>
          )}

          {/* Main content */}
          <main className="flex min-w-0 flex-1 flex-col">
            {/* Mobile top bar - always visible so user can navigate */}
            <div className="flex items-center justify-between border-b border-border bg-surface-elevated px-3 py-2 md:hidden">
              <button
                onClick={() => setShowOverlay("sidebar")}
                aria-label="Open navigation"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
              <img src="/CONVO_FLOW_LOGO.png" alt="ConvoFlow" className="h-7 w-auto" />
              <button
                onClick={() => {
                  setChatlistMode("chats");
                  setShowOverlay("chatlist");
                }}
                aria-label="Open conversations"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            </div>

            <div className="flex flex-1 min-h-0">
              <Outlet />
            </div>
          </main>
        </div>
      </ChatProvider>
    </WebSocketProvider>
  );
}
