import { Outlet } from "react-router-dom";
import ChatList from "./ChatList";
import Sidebar from "./Sidebar";
import { ChatProvider } from "../context/ChatContext";
import { WebSocketProvider } from "../context/WebSocketContext";

export default function RootLayout() {
  return (
    <WebSocketProvider>
      <ChatProvider>
        <div className="flex h-dvh">
          <Sidebar />
          <ChatList />
          <main className="flex min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </ChatProvider>
    </WebSocketProvider>
  );
}
