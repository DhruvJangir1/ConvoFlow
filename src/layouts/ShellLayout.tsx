import { ChartArea } from "lucide-react";
import Navbar from "./Navbar";
import ChatList from "./ChatList";


export default function ShellLayout() {
  return (
    <div className="flex h-full w-full flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <ChatList />
        <ChartArea />
      </div>
    </div>
  );
}
