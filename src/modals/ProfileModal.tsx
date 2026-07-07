import { useState } from "react";
import { X, Copy, Check, LogOut, Pencil, Calendar, MessageSquare, Hash, Shield } from "lucide-react";
import { useSelector } from "react-redux";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import type { RootState } from "../store/store";
import UserAvatar from "../components/UserAvatar";

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
      className="flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function StatPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-border bg-surface px-6 py-3.5">
      <Icon className="h-4 w-4 text-text-muted" />
      <span className="truncate text-center text-sm font-semibold tabular-nums text-text-primary">{value}</span>
      <span className="text-[11px] text-text-muted">{label}</span>
    </div>
  );
}

function AccountRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <span className="max-w-[260px] truncate text-right text-sm text-text-primary">{value}</span>
        {copyable && <CopyButton value={value} />}
      </div>
    </div>
  );
}

export default function ProfileModal({ isOpen, onClose, onEditProfile }: Props) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const user = useSelector((s: RootState) => s.userAuth.user);
  const conversations = useSelector((s: RootState) => s.chat?.chats ?? []);

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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh] backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="animate-modal-in w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold text-text-primary">Profile</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── Gradient banner + Avatar ── */}
        <div className="relative">
          {/* Mesh gradient banner */}
          <div
            className="h-20 w-full"
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
            <div className="relative">
              <UserAvatar imageUrl={user.image_url ?? null} userName={user.user_name} size="lg" />
              {/* Online indicator */}
              <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-surface-elevated bg-green-400" />
            </div>
          </div>
        </div>

        {/* ── Identity ── */}
        <div className="mt-10 flex flex-col items-center gap-1 px-6 pb-4 text-center">
          <p className="text-[17px] font-semibold leading-tight text-text-primary">{user.user_name}</p>
          <p className="text-sm text-text-muted">{user.email}</p>

          {/* Badges */}
          <div className="mt-2 flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-400">
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
        <div className="flex gap-2 px-4 pb-4">
          <StatPill icon={MessageSquare} label="Chats" value={conversations.length} />
          <StatPill icon={Hash} label="Messages" value={totalMessages} />
          <StatPill icon={Calendar} label="Joined" value={memberSince} />
        </div>

        {/* ── Account details ── */}
        <div className="mx-4 mb-4 rounded-xl border border-border bg-surface px-4">
          <p className="pt-3 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
            Account
          </p>
          <div className="divide-y divide-border/50">
            <AccountRow label="Username" value={user.user_name} copyable />
            <AccountRow label="UserTag" value={user.user_tag} copyable />
            <AccountRow label="Email" value={user.email} copyable />
            <AccountRow label="Member since" value={memberSince} />
            <AccountRow label="Plan" value={plan} />
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onEditProfile}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Profile
          </button>
          <button
            onClick={async () => { await logout(); navigate('/'); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}