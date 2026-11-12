import { useState } from "react";
import { X, Copy, Check, LogOut, Pencil, Calendar, MessageSquare, Hash, Shield } from "lucide-react";
import { useSelector } from "react-redux";
import { useClerk } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import type { RootState } from "../store/store";
import UserAvatar from "../components/UserAvatar";
import ProfileImageModal from "./ProfileImageModal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onEditProfile?: () => void;
}

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
      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-accent-success" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function StatPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="flex w-full min-w-0 max-w-full flex-col items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-3 sm:px-4">
      <Icon className="h-4 w-4 text-text-muted" />
      <span className="w-full text-center text-xs font-semibold tabular-nums text-text-primary sm:text-sm [overflow-wrap:anywhere]">{value}</span>
      <span className="text-center text-[10px] text-text-muted sm:text-[11px]">{label}</span>
    </div>
  );
}

function AccountRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1 py-3 min-[24rem]:flex-row min-[24rem]:items-center min-[24rem]:justify-between min-[24rem]:gap-2">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <div className="flex w-full min-w-0 flex-1 items-center gap-2 min-[24rem]:justify-end">
        <span className="min-w-0 flex-1 text-left text-xs text-text-primary min-[24rem]:text-right sm:text-sm [overflow-wrap:anywhere]">{value}</span>
        {copyable && <CopyButton value={value} />}
      </div>
    </div>
  );
}

export default function ProfileModal({ isOpen, onClose, onEditProfile }: Props) {
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const user = useSelector((s: RootState) => s.userAuth.user);
  const conversations = useSelector((s: RootState) => s.chat.chats);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  if (!isOpen || !user) return null;

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";

  const totalMessages = conversations.reduce<number>(
    (sum, c) => sum + (c.messageCount ?? 0),
    0
  );

  const plan: string = (user as { plan?: string }).plan ?? "Free";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="animate-modal-in max-h-[calc(100dvh-1.5rem)] w-full max-w-full overflow-y-auto rounded-2xl border border-border bg-surface-elevated shadow-2xl shadow-black/50 sm:max-h-[calc(100dvh-3rem)] sm:max-w-[32rem]"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold text-text-primary">Profile</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── Gradient banner + Avatar ── */}
        <div className="relative">
          {/* Mesh gradient banner */}
          <div
            className="aspect-[5/1] max-h-32 w-full"
            style={{
              background: `
                radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.25) 0%, transparent 60%),
                radial-gradient(ellipse at 80% 30%, rgba(168,85,247,0.2) 0%, transparent 55%),
                radial-gradient(ellipse at 50% 90%, rgba(59,130,246,0.15) 0%, transparent 60%),
                linear-gradient(135deg, #13141a 0%, #0e0f14 100%)
              `,
            }}
          />

          {/* Avatar overlapping banner */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
            <button
              onClick={() => setImageModalOpen(true)}
              className="relative cursor-pointer rounded-full transition-transform hover:scale-105 focus:outline-none"
            >
              <UserAvatar imageUrl={user.image_url} userName={user.user_name} size="lg" />
             
              {/* Online indicator */}
              <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-surface-elevated bg-green-400" />
            </button>
          </div>
        </div>

        {/* ── Identity ── */}
        <div className="mt-10 flex w-full max-w-full flex-col items-center gap-1 px-4 pb-4 text-center sm:px-6">
          <p className="max-w-full text-[17px] font-semibold leading-tight text-text-primary [overflow-wrap:anywhere]">{user.user_name}</p>
          <p className="max-w-full text-sm text-text-muted [overflow-wrap:anywhere]">{user.email}</p>

          {/* Badges */}
          <div className="mt-2 flex max-w-full flex-wrap items-center justify-center gap-2">
            <span className="flex items-center gap-1 rounded-full border border-accent-success/20 bg-accent-success/10 px-2 py-0.5 text-[11px] font-medium text-accent-success">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Online
            </span>
            <span className="flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-text-muted">
              <Shield className="h-3 w-3" />
              {plan} Plan
            </span>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid w-full max-w-full grid-cols-1 gap-2 px-4 pb-4 min-[40rem]:grid-cols-3">
          <StatPill icon={MessageSquare} label="Chats" value={conversations.length} />
          <StatPill icon={Hash} label="Messages" value={totalMessages} />
          <StatPill icon={Calendar} label="Joined" value={memberSince} />
        </div>

        {/* ── Account details ── */}
        <div className="mb-4 w-full max-w-full px-4">
          <div className="w-full max-w-full rounded-xl border border-border bg-surface px-3 sm:px-4">
            <p className="pt-3 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
              Account
            </p>
            <div className="w-full max-w-full divide-y divide-border/50">
              <AccountRow label="Username" value={user.user_name} copyable />
              <AccountRow label="UserTag" value={user.user_tag} copyable />
              <AccountRow label="Email" value={user.email} copyable />
              <AccountRow label="Member since" value={memberSince} />
              <AccountRow label="Plan" value={plan} />
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="grid w-full max-w-full grid-cols-1 gap-2 border-t border-border px-4 py-3 min-[40rem]:grid-cols-2">
          <button
            onClick={onEditProfile}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Profile
          </button>
          <button
            onClick={async () => { await signOut(); navigate('/'); }}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-accent-danger/20 bg-accent-danger/10 py-2 text-sm font-medium text-accent-danger transition-colors hover:bg-accent-danger/20"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>

{ imageModalOpen &&
      <ProfileImageModal
        onClose={() => setImageModalOpen(false)}
        imageUrl={user.image_url ?? null}
        userName={user.user_name}
      />
}
    </div>
  );
}
