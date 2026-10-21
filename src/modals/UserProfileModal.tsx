import { X } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import UserAvatar from "../components/UserAvatar";
import { useUserProfileQuery } from "../hooks/useUserProfileQuery";
import type { UserProfile } from "../types/chat";

interface Props {
  userId: string | null;
  onClose: () => void;
}

function formatJoined(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function UserProfileModal({ userId, onClose }: Props) {
  const reduxUser = useSelector((s: RootState) => s.userAuth.user);

  const isSelf = userId !== null && reduxUser !== null && userId === reduxUser.id;
  const { data, isLoading, isError } = useUserProfileQuery(isSelf ? null : userId);

  if (!userId) return null;

  let profile: UserProfile | null = null;
  if (isSelf && reduxUser) {
    profile = {
      id: reduxUser.id,
      user_name: reduxUser.user_name,
      user_tag: reduxUser.user_tag,
      bio: reduxUser.bio,
      image_url: reduxUser.image_url,
      created_at: reduxUser.created_at,
    };
  } else if (data) {
    profile = data;
  }

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="animate-modal-in flex w-[min(90vw,20rem)] max-h-[90vh] flex-col overflow-y-auto rounded-2xl border border-border bg-surface-elevated p-6 shadow-2xl shadow-black/50 aspect-[1/2]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end">
          <button
            onClick={onClose}
            aria-label="Close profile"
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {isLoading || (!profile && !isError) ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-sm text-text-muted">Loading…</span>
          </div>
        ) : isError || !profile ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-sm text-text-muted">Could not load profile.</span>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="flex items-start gap-4">
              <UserAvatar imageUrl={profile.image_url} userName={profile.user_name} size="xl" />
              <div className="min-w-0 flex-1 pt-1">
                <h2 className="truncate text-lg font-semibold text-text-primary">
                  {profile.user_name}
                </h2>
                <p className="mt-1 text-sm text-text-muted whitespace-pre-wrap">
                  {profile.bio && profile.bio.trim() ? profile.bio : "No bio yet"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <div className="rounded-xl border border-border bg-surface px-3 py-2">
                <span className="block text-[11px] uppercase tracking-wide text-text-muted">User tag</span>
                <span className="block truncate text-sm font-medium text-text-primary">{profile.user_tag}</span>
              </div>
              <div className="rounded-xl border border-border bg-surface px-3 py-2">
                <span className="block text-[11px] uppercase tracking-wide text-text-muted">Joined at</span>
                <span className="block text-sm font-medium text-text-primary">{formatJoined(profile.created_at)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
