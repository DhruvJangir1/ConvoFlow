import { LogOut } from "lucide-react";
import { useSelector } from "react-redux";
import { useClerk } from "@clerk/react";
import type { RootState } from "../store/store";
import { useNavigate } from "react-router-dom";
import UserAvatar from "../components/UserAvatar";

export default function Navbar() {
  const user = useSelector((s: RootState) => s.userAuth.user);
  const { signOut } = useClerk();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-border/60 bg-navbar px-4">
      <span className="text-sm text-text-muted">{user?.user_name}</span>

      <button
        onClick={handleLogout}
        className="group flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-all duration-200 ease-out hover:bg-surface-hover hover:text-red-400"
        title="Log out"
      >
        <LogOut className="h-4 w-4 transition-transform duration-200 ease-out group-hover:scale-110" />
      </button>

      <button
        onClick={() => navigate("/profile")}
        className="group flex items-center justify-center rounded-full transition-all duration-200 ease-out hover:opacity-80"
        title="Profile"
      >
        <UserAvatar imageUrl={user?.image_url ?? null} userName={user?.user_name ?? "User"} size="sm" />
      </button>
    </header>
  );
}
