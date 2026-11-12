import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useClerk } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import type { RootState, AppDispatch } from "../store/store";
import UserAvatar from "../components/UserAvatar";
import ProfileImageModal from "../modals/ProfileImageModal";
import { updateUserBioAction } from "../lib/updateUserBio";
import { ArrowLeft, Copy, Check, LogOut, Pencil, Calendar, Hash, Send } from "lucide-react";

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
      <span className="min-w-0 flex-1 text-right text-[clamp(0.8rem,2.8vw,1rem)] text-text-primary [overflow-wrap:anywhere]">{value}</span>
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

  return (
    <div className="relative flex h-full w-full max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto bg-surface pt-[2.5svh]">

      <div className="w-full max-w-full">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-[3vw] py-[1.5svh] border-b border-border/50">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="font-semibold text-text-primary" style={{ fontSize: "clamp(1rem, 3.5vw, 1.3rem)" }}>
          Profile
        </p>
      </div>

      {/* ── Avatar + Bio ── */}
      <div className="flex w-full max-w-full flex-col items-start gap-4 px-4 pt-6 sm:flex-row sm:gap-6 sm:px-6 lg:px-8">
        <button
          onClick={() => setImageModalOpen(true)}
          className="relative shrink-0 cursor-pointer rounded-full transition-transform hover:scale-105 focus:outline-none"
        >
          {user.image_url ? (
            <img
              src={user.image_url}
              alt={user.user_name}
              className="aspect-square rounded-full object-cover ring-4 ring-surface shadow-xl"
              style={{ width: "clamp(4.5rem, 10vw, 7rem)" }}
            />
          ) : (
            <div className="aspect-square rounded-full ring-4 ring-surface shadow-xl" style={{ width: "clamp(4.5rem, 10vw, 7rem)" }}>
              <UserAvatar imageUrl={user.image_url} userName={user.user_name} size="lg" />
            </div>
          )}
          <span className="absolute bottom-[0.5vw] right-[0.5vw] h-[clamp(0.7rem,2vw,1rem)] w-[clamp(0.7rem,2vw,1rem)] rounded-full border-[0.2vw] border-surface bg-green-400" />
        </button>

        <div className="w-full min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="break-words font-semibold leading-tight text-text-primary [overflow-wrap:anywhere]" style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}>
              {user.user_name}
            </p>
            <p className="text-base text-text-muted [overflow-wrap:anywhere]">{user.user_tag}</p>
            <span className="mt-1 flex w-fit max-w-full items-center gap-1.5 rounded-full border border-accent-success/20 bg-accent-success/10 px-3 py-1 text-sm font-medium text-accent-success">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
              Online
            </span>
          </div>

          {/* ── Bio bubble ── */}
          <div className="mt-4 w-full max-w-full">
            {editingBio ? (
              <div className="flex w-full min-w-0 items-center gap-2 rounded-2xl border border-accent/50 bg-surface-raised px-4 py-4 sm:px-5">
                <textarea
                  autoFocus
                  value={bioValue}
                  onChange={(e) => setBioValue(e.target.value)}
                  onBlur={() => { setBioValue(user.bio ?? ""); setEditingBio(false); }}
                  rows={2}
                  maxLength={120}
                  placeholder="Write something about yourself..."
                  className="min-h-12 min-w-0 flex-1 resize-none bg-transparent text-[clamp(0.8rem,2.8vw,1rem)] leading-relaxed text-text-primary placeholder-text-muted outline-none"
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
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setBioValue(user.bio ?? ""); setEditingBio(true); }}
                className="w-full min-w-0 rounded-2xl border border-border/50 bg-surface-raised px-4 py-4 text-left transition-colors hover:bg-surface-hover sm:px-5"
              >
                <p className="whitespace-pre-wrap break-words text-[clamp(0.8rem,2.8vw,1rem)] leading-relaxed text-text-primary">
                  {user.bio || "No bio yet"}
                </p>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Account info lines ── */}
      <div className="pt-[3svh]">
        <p className="px-4 pb-[1.5svh] text-[clamp(0.6rem,2vw,0.75rem)] font-semibold uppercase tracking-widest text-text-muted sm:px-6 lg:px-8">
          Account
        </p>
        <InfoLine icon={Pencil} label="Username" value={user.user_name} copyable />
        <InfoLine icon={Hash} label="User Tag" value={user.user_tag} copyable />
        <InfoLine icon={Calendar} label="Member since" value={memberSince} />
      </div>

      {/* ── Actions ── */}
      <div className="grid w-full max-w-full grid-cols-1 gap-3 px-4 pt-[3svh] pb-[5svh] sm:grid-cols-2 sm:px-6 lg:px-8">
        <button
          className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface py-3 font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          style={{ fontSize: "clamp(0.75rem, 2.5vw, 0.95rem)" }}
        >
          <Pencil style={{ width: "clamp(0.85rem, 2.5vw, 1.1rem)", height: "clamp(0.85rem, 2.5vw, 1.1rem)" }} />
          Edit Profile
        </button>
        <button
          onClick={async () => { await signOut(); navigate("/"); }}
          className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-accent-danger/20 bg-accent-danger/10 py-3 font-medium text-accent-danger transition-colors hover:bg-accent-danger/20"
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
