import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useClerk } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import type { RootState, AppDispatch } from "../store/store";
import UserAvatar from "../components/UserAvatar";
import ProfileImageModal from "../modals/ProfileImageModal";
import { updateUserBioAction } from "../lib/updateUserBio";
import { Copy, Check, LogOut, Pencil, Calendar, Hash, Send } from "lucide-react";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-accent-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function InfoLine({ label, value, copyable, icon: Icon }: { label: string; value: string; copyable?: boolean; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-4 px-[5vw] sm:px-[4vw] md:px-[3vw] py-[2.5svh] sm:py-[3svh] border-b border-border/50">
      <span className="flex items-center gap-2.5 text-[clamp(0.7rem,2.5vw,0.85rem)] font-medium text-text-muted shrink-0 w-[35%] sm:w-[30%]">
        {Icon && <Icon className="h-[clamp(0.85rem,2.5vw,1.1rem)] w-[clamp(0.85rem,2.5vw,1.1rem)] opacity-60" />}
        {label}
      </span>
      <span className="min-w-0 flex-1 flex justify-end truncate text-[clamp(0.8rem,2.8vw,1rem)] text-text-primary">{value}</span>
      {copyable && <CopyButton value={value} />}
    </div>
  );
}

export default function ProfileView() {
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.userAuth.user);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState("");
  const [savingBio, setSavingBio] = useState(false);

  if (!user) return null;

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";

  const avatarSize = "clamp(8rem, 25vw, 12rem)";

  return (
    <div className="relative flex flex-1 flex-col bg-surface overflow-y-auto overflow-x-hidden h-full w-full pt-[2.5svh]">

      <div className="w-full">

      {/* ── Header ── */}
      <div className="flex items-center px-[3vw] py-[1.5svh] border-b border-border/50">
        <p className="font-semibold text-text-primary" style={{ fontSize: "clamp(1rem, 3.5vw, 1.3rem)" }}>
          Profile
        </p>
      </div>

      {/* ── Avatar + Bio ── */}
      <div className="flex items-center gap-[4vw] px-[3vw] pt-[3svh]">
        <button
          onClick={() => setImageModalOpen(true)}
          className="shrink-0 cursor-pointer rounded-full transition-transform hover:scale-105 focus:outline-none"
        >
          {user.image_url ? (
            <img
              src={user.image_url}
              alt={user.user_name}
              className="rounded-full object-cover ring-[0.35vw] ring-surface shadow-xl"
              style={{ width: avatarSize, height: avatarSize }}
            />
          ) : (
            <div className="rounded-full ring-[0.35vw] ring-surface shadow-xl" style={{ width: avatarSize, height: avatarSize }}>
              <UserAvatar imageUrl={user.image_url} userName={user.user_name} size="lg" />
            </div>
          )}
          <span className="absolute bottom-[0.5vw] right-[0.5vw] h-[clamp(0.7rem,2vw,1rem)] w-[clamp(0.7rem,2vw,1rem)] rounded-full border-[0.2vw] border-surface bg-green-400" />
        </button>

        {/* ── Bio bubble ── */}
        {editingBio ? (
          <div className="flex flex-1 min-w-0 items-center gap-2 rounded-full border border-accent/50 bg-surface-raised px-5 py-4">
            <textarea
              autoFocus
              value={bioValue}
              onChange={(e) => setBioValue(e.target.value)}
              onBlur={() => { setBioValue(user.bio ?? ""); setEditingBio(false); }}
              rows={2}
              maxLength={120}
              placeholder="Write something about yourself..."
              className="flex-1 min-w-0 resize-none bg-transparent text-[clamp(0.8rem,2.8vw,1rem)] leading-relaxed text-text-primary placeholder-text-muted outline-none"
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={async () => {
                setSavingBio(true);
                await updateUserBioAction(user.id, bioValue, dispatch);
                setSavingBio(false);
                setEditingBio(false);
              }}
              disabled={savingBio}
              className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setBioValue(user.bio ?? ""); setEditingBio(true); }}
            className="flex-1 min-w-0 rounded-full border border-border/50 bg-surface-raised px-5 py-4 text-left cursor-pointer transition-colors hover:bg-surface-hover"
          >
            <p className="text-[clamp(0.8rem,2.8vw,1rem)] leading-relaxed text-text-primary whitespace-pre-wrap break-words">
              {user.bio || "No bio yet"}
            </p>
          </button>
        )}
      </div>

      {/* ── Name ── */}
      <div className="flex flex-col gap-1 pt-[2.5svh] px-[3vw]">
        <p className="font-semibold leading-tight text-text-primary" style={{ fontSize: "clamp(1.1rem, 4vw, 1.6rem)" }}>
          {user.user_name}
        </p>
      </div>

      {/* ── Status badges ── */}
      <div className="flex justify-start gap-3 pt-[2svh] px-[3vw]">
        <span className="flex items-center gap-1.5 rounded-full border border-accent-success/20 bg-accent-success/10 px-3 py-1 font-medium text-accent-success" style={{ fontSize: "clamp(0.65rem, 2.2vw, 0.8rem)" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          Online
        </span>
      </div>

      {/* ── Account info lines ── */}
      <div className="pt-[3svh]">
        <p className="px-[5vw] sm:px-[4vw] md:px-[3vw] pb-[1.5svh] text-[clamp(0.6rem,2vw,0.75rem)] font-semibold uppercase tracking-widest text-text-muted">
          Account
        </p>
        <InfoLine icon={Pencil} label="Username" value={user.user_name} copyable />
        <InfoLine icon={Hash} label="User Tag" value={user.user_tag} copyable />
        <InfoLine icon={Calendar} label="Member since" value={memberSince} />
      </div>

      {/* ── Actions ── */}
      <div className="flex w-full gap-3 px-[5vw] sm:px-[4vw] md:px-[3vw] pt-[3svh] pb-[5svh]">
        <button
          className="flex flex-1 items-center justify-center gap-2.5 rounded-xl border border-border bg-surface py-[2.5svh] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          style={{ fontSize: "clamp(0.75rem, 2.5vw, 0.95rem)" }}
        >
          <Pencil style={{ width: "clamp(0.85rem, 2.5vw, 1.1rem)", height: "clamp(0.85rem, 2.5vw, 1.1rem)" }} />
          Edit Profile
        </button>
        <button
          onClick={async () => { await signOut(); navigate("/"); }}
          className="flex flex-1 items-center justify-center gap-2.5 rounded-xl border border-accent-danger/20 bg-accent-danger/10 py-[2.5svh] font-medium text-accent-danger transition-colors hover:bg-accent-danger/20"
          style={{ fontSize: "clamp(0.75rem, 2.5vw, 0.95rem)" }}
        >
          <LogOut style={{ width: "clamp(0.85rem, 2.5vw, 1.1rem)", height: "clamp(0.85rem, 2.5vw, 1.1rem)" }} />
          Sign Out
        </button>
      </div>
      </div>

      {imageModalOpen && (
        <ProfileImageModal
          onClose={() => setImageModalOpen(false)}
          imageUrl={user.image_url ?? null}
          userName={user.user_name}
        />
      )}
    </div>
  );
}
