import { useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import ProfileModal from "../modals/ProfileModal";
import UserAvatar from "../components/UserAvatar";
import PersonOutlined from "@mui/icons-material/PersonOutlined";

export default function ProfileView() {
  const user = useSelector((s: RootState) => s.userAuth.user);
  const [modalOpen, setModalOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="relative flex flex-1 flex-col bg-surface">
      <div className="pointer-events-none absolute -left-20 sm:-left-40 -top-20 sm:-top-40 h-64 w-64 sm:h-96 sm:w-96 rounded-full bg-accent-cyan/5 blur-[128px]" />
      <div className="pointer-events-none absolute -bottom-20 sm:-bottom-40 -right-20 sm:-right-40 h-64 w-64 sm:h-96 sm:w-96 rounded-full bg-accent/5 blur-[128px]" />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="h-20 w-20">
          {user.image_url ? (
            <UserAvatar imageUrl={user.image_url} userName={user.user_name} size="lg" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/20">
              <PersonOutlined className="text-accent" style={{ fontSize: 40 }} />
            </div>
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{user.user_name}</h2>
          <p className="text-sm text-text-muted">{user.email}</p>
          <p className="mt-1 text-xs text-text-muted">Tag: {user.user_tag}</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Edit Profile
        </button>
      </div>
      <ProfileModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
