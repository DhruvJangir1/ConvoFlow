import { useNavigate, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { useAuth } from "../context/AuthContext";
import {
  Heart,
  MessageCircle,
  Share2,
  Users,
  Radio,
  Sparkles,
  Flame,
  TrendingUp,
  Zap,
} from "lucide-react";

function hashToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function avatarGradient(name: string): string {
  const hue = hashToHue(name);
  return `linear-gradient(135deg, hsl(${hue}, 65%, 45%), hsl(${(hue + 80) % 360}, 55%, 35%))`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface Post {
  handle: string;
  content: string;
  timestamp: string;
  likes: number;
  replies: number;
  hue: number;
}

const posts: Post[] = [
  {
    handle: "brayden_99",
    content:
      "if the professor doesn't show up in the next 4 minutes we are legally allowed to leave right? i didn't wake up at 8am for nothing",
    timestamp: "4m ago",
    likes: 112,
    replies: 23,
    hue: 25,
  },
  {
    handle: "chloe.v",
    content:
      "Submitting an empty PDF at 11:59 PM just to buy myself an extra 12 hours of sleep while the professor emails me about a 'corrupted file'",
    timestamp: "18m ago",
    likes: 340,
    replies: 42,
    hue: 310,
  },
  {
    handle: "sk8r_lucas",
    content:
      "currently rawdogging this midterm with 0 minutes of studying and a large iced coffee. wish me luck boys about to get a solid 12%",
    timestamp: "45m ago",
    likes: 89,
    replies: 14,
    hue: 160,
  },
  {
    handle: "emily_is_tired",
    content:
      "Me watching the lecture at 3x speed the morning of the exam sounds like a chipmunk yelling at me about macroeconomics",
    timestamp: "2h ago",
    likes: 215,
    replies: 31,
    hue: 210,
  },
];

const pollOptions = [
  { label: "Biology", pct: 38, color: "from-pink-500 to-purple-500" },
  { label: "Calculus", pct: 45, color: "from-orange-500 to-rose-500" },
  { label: "Physics", pct: 17, color: "from-cyan-500 to-blue-500" },
];

export default function WelcomePage() {
  const user = useSelector((s: RootState) => s.userAuth.user);
  const { loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="relative grid min-h-dvh grid-cols-1 overflow-hidden bg-surface lg:grid-cols-12">
      <div className="pointer-events-none absolute right-1/4 top-1/2 h-[450px] w-[450px] -translate-y-1/2 rounded-full bg-accent/15 blur-[180px]" />

      {/* ── Left Side: Info / Feed (Scaled / Tightened Down) ── */}
      <div className="relative col-span-1 hidden flex-col justify-center overflow-hidden px-10 py-12 lg:flex lg:col-span-6">
        <div className="relative z-10 max-w-lg">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-secondary" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-secondary" />
            </span>
            <span className="text-[8px] font-semibold uppercase tracking-[0.15em] bg-linear-to-r from-accent-secondary to-accent bg-clip-text text-transparent">
              Live community
            </span>
          </div>

          <h1 className="mt-2 text-xl font-bold leading-tight tracking-tight">
            <span className="text-text-primary">Your Community.</span>{" "}
            <span className="bg-linear-to-r from-accent via-accent-secondary to-accent-success bg-clip-text text-transparent">
              Log in and connect.
            </span>
          </h1>

          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            See what your classmates are up to. Dive into a world of shared learning.
          </p>

          <div className="mt-6 flex max-h-[400px] flex-col gap-2.5 overflow-y-auto pr-1.5 scrollbar-thin">
            {posts.map((post) => (
              <div
                key={post.handle + post.timestamp}
                className="group rounded-xl border border-border bg-surface-elevated/60 p-3.5 transition-all duration-300 hover:scale-[1.01]"
                style={{
                  borderColor: `hsla(${post.hue}, 60%, 50%, 0.15)`,
                  boxShadow: `0 0 20px hsla(${post.hue}, 60%, 50%, 0.02)`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `hsla(${post.hue}, 70%, 55%, 0.4)`;
                  e.currentTarget.style.boxShadow = `0 0 30px hsla(${post.hue}, 60%, 50%, 0.08)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `hsla(${post.hue}, 60%, 50%, 0.15)`;
                  e.currentTarget.style.boxShadow = `0 0 20px hsla(${post.hue}, 60%, 50%, 0.02)`;
                }}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[7px] font-semibold text-white ring-2 ring-white/5 transition-transform duration-300 group-hover:scale-105"
                    style={{ background: avatarGradient(post.handle) }}
                  >
                    {getInitials(post.handle)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] font-semibold text-text-primary truncate">
                        @{post.handle}
                      </span>
                      <span className="text-[8px] text-text-muted shrink-0 ml-2">{post.timestamp}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-text-secondary whitespace-normal break-words">
                      {post.content}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-4 border-t border-border/40 pt-2.5">
                  <button className="group/btn flex items-center gap-1 text-[8px] text-text-muted transition-all duration-200 hover:text-accent-secondary">
                    <Heart className="h-2.5 w-2.5 transition-all duration-200 group-hover/btn:scale-110 group-hover/btn:fill-current" />
                    <span>{post.likes}</span>
                  </button>
                  <button className="group/btn flex items-center gap-1 text-[8px] text-text-muted transition-all duration-200 hover:text-accent">
                    <MessageCircle className="h-2.5 w-2.5 transition-all duration-200 group-hover/btn:scale-110" />
                    <span>{post.replies}</span>
                  </button>
                  <button className="group/btn ml-auto flex items-center gap-1 text-[8px] text-text-muted transition-all duration-200 hover:text-accent-success">
                    <Share2 className="h-2.5 w-2.5 transition-all duration-200 group-hover/btn:scale-110" />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            ))}

            {/* Poll Component */}
            <div
              className="rounded-xl border border-border bg-surface-elevated/60 p-3.5 transition-all duration-300 hover:scale-[1.01]"
              style={{ borderColor: `hsla(270, 60%, 50%, 0.15)` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `hsla(270, 70%, 55%, 0.4)`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = `hsla(270, 60%, 50%, 0.15)`; }}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-accent" />
                <span className="text-[8px] font-semibold uppercase tracking-[0.08em] bg-linear-to-r from-accent to-accent-secondary bg-clip-text text-transparent">
                  Live Poll
                </span>
              </div>
              <p className="text-[10px] font-medium text-text-primary">
                What&rsquo;s the hardest subject this semester?
              </p>
              <div className="mt-2.5 space-y-2">
                {pollOptions.map((opt) => (
                  <div key={opt.label}>
                    <div className="flex items-center justify-between text-[8px]">
                      <span className="text-text-secondary">{opt.label}</span>
                      <span className="text-text-muted">{opt.pct}%</span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                      <div
                        className={`h-full rounded-full bg-linear-to-r ${opt.color} transition-all duration-700 ease-out`}
                        style={{ width: `${opt.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 border-t border-border/40 pt-2.5">
                <button className="group/btn flex items-center gap-1 text-[8px] text-text-muted transition-all duration-200 hover:text-accent">
                  <Heart className="h-2.5 w-2.5 transition-all duration-200 group-hover/btn:scale-110 group-hover/btn:fill-current" />
                  <span>18</span>
                </button>
              </div>
            </div>

            {/* Group Preview */}
            <div
              className="rounded-xl border border-border bg-surface-elevated/60 p-3.5 transition-all duration-300 hover:scale-[1.01]"
              style={{ borderColor: `hsla(170, 60%, 40%, 0.15)` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `hsla(170, 70%, 45%, 0.4)`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = `hsla(170, 60%, 40%, 0.15)`; }}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-1.5">
                  {["ZaraM", "JayT", "PriyaR"].map((name) => (
                    <div
                      key={name}
                      className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface text-[6px] font-semibold text-white transition-transform duration-200 hover:scale-105"
                      style={{ background: avatarGradient(name) }}
                    >
                      {getInitials(name)}
                    </div>
                  ))}
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-gradient-to-br from-accent to-accent-secondary text-[6px] font-semibold text-white">
                    +12
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-text-primary truncate">The Chem Squad</p>
                  <p className="text-[8px] text-text-muted truncate">24 members &middot; 3 online</p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2.5">
                <button className="flex items-center gap-1 text-[8px] font-medium transition-all duration-200 hover:scale-102"
                  style={{ color: `hsl(170, 60%, 55%)` }}
                >
                  <Users className="h-2.5 w-2.5" />
                  <span>Join chat</span>
                </button>
                <div className="flex items-center gap-1 text-[8px] text-text-muted">
                  <MessageCircle className="h-2.5 w-2.5" />
                  <span>142 messages today</span>
                </div>
              </div>
            </div>

            {/* Live Card */}
            <div className="rounded-xl border border-accent/15 bg-gradient-to-br from-accent/5 via-accent-secondary/5 to-accent-success/5 p-3.5 transition-all duration-300 hover:scale-[1.01]">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-accent-secondary to-rose-500">
                  <Radio className="h-3 w-3 text-white" />
                  <span className="absolute flex h-6 w-6">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-secondary/20" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-text-primary truncate">
                    Professor Al-Fayed is live
                  </p>
                  <p className="flex items-center gap-1 text-[8px] text-text-muted truncate">
                    <span className="relative flex h-1 w-1 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-secondary" />
                      <span className="relative inline-flex h-1 w-1 rounded-full bg-accent-secondary" />
                    </span>
                    Advanced Algorithms forum
                  </p>
                </div>
                <span className="animate-pulse rounded-md bg-accent-secondary/15 px-1 py-0.5 text-[7px] font-bold text-accent-secondary shrink-0">
                  LIVE
                </span>
              </div>
            </div>
          </div>

          {/* Metrics Footer */}
          <div className="mt-4 flex items-center justify-center gap-6 rounded-xl border border-border/40 bg-gradient-to-r from-accent/5 via-accent-secondary/5 to-accent-success/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {[
                  { name: "ZaraM", hue: 300 },
                  { name: "JayT", hue: 50 },
                  { name: "PriyaR", hue: 180 },
                ].map(({ name, hue }) => (
                  <div
                    key={name}
                    className="h-5 w-5 rounded-full border border-surface"
                    style={{
                      background: `linear-gradient(135deg, hsl(${hue}, 65%, 45%), hsl(${(hue + 80) % 360}, 55%, 35%))`,
                    }}
                  />
                ))}
              </div>
              <div>
                <p className="text-[10px] font-bold bg-linear-to-r from-accent to-accent-secondary bg-clip-text text-transparent">
                  1,200+
                </p>
                <p className="text-[8px] text-text-muted whitespace-nowrap">active now</p>
              </div>
            </div>
            <div className="h-6 w-px bg-gradient-to-b from-border/40 to-transparent" />
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-accent-secondary" />
              <p className="text-[10px]">
                <span className="font-bold bg-linear-to-r from-accent-secondary to-accent-success bg-clip-text text-transparent">
                  50K+
                </span>{" "}
                <span className="text-text-muted">notes</span>
              </p>
            </div>
            <div className="h-6 w-px bg-gradient-to-b from-border/40 to-transparent" />
            <div className="flex items-center gap-1">
              <Flame className="h-3 w-3 text-accent-danger" />
              <p className="text-[10px]">
                <span className="font-bold text-text-primary">4.9</span>{" "}
                <span className="text-text-muted">rating</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Side: Auth Module ── */}
      <div className="relative col-span-1 flex min-h-dvh items-center justify-center px-4 py-8 lg:col-span-6">
        <div className="w-full max-w-xs">
          {/* Mobile-only Header */}
          <div className="mb-6 text-center lg:hidden">
            <img src="/CONVO_FLOW_LOGO.png" alt="" className="mx-auto h-9 w-auto" />
            <h1 className="mt-4 text-base font-bold tracking-tight text-text-primary">
              Welcome to ConvoFlow
            </h1>
            <p className="mt-1 text-[10px] text-text-secondary">
              The nicest place to talk with the people you love.
            </p>
          </div>

          {/* Box Container */}
          <div className="relative rounded-xl border border-border bg-surface-elevated/80 p-8 shadow-xl shadow-black/40 backdrop-blur-xl transition-all duration-300 hover:border-border-active">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-5 hidden h-16 w-16 items-center justify-center lg:flex">
                <img
                  src="/CONVO_FLOW_LOGO.png"
                  alt="ConvoFlow"
                  className="h-full w-full object-contain"
                />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-text-primary">
                Get started
              </h2>
              <p className="mt-1 text-xs text-text-secondary">
                Create an account or sign in to continue
              </p>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => navigate("/signup")}
                className="group relative flex-1 cursor-pointer overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-accent px-2.5 py-2 text-xs font-semibold text-white shadow-md transition-all duration-300 hover:shadow-lg active:scale-[0.98]"
              >
                <span className="relative z-10 flex items-center justify-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Sign Up
                </span>
                <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
              </button>

              <button
                onClick={() => navigate("/login")}
                className="group flex-1 cursor-pointer rounded-lg border border-white/5 bg-white/5 px-2.5 py-2 text-xs font-semibold text-white/80 backdrop-blur-sm transition-all duration-200 hover:border-white/10 hover:bg-white/10 hover:text-white active:scale-[0.98]"
              >
                <span className="flex items-center justify-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Log In
                </span>
              </button>
            </div>

            <p className="mt-6 text-center text-[10px] text-text-muted">
              By continuing, you agree to ConvoFlow&apos;s Terms of Service.
            </p>
          </div>

          {/* Bottom Banner */}
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated/40 px-3 py-2 lg:hidden">
            <Sparkles className="h-3 w-3 text-accent-secondary" />
            <p className="text-[8px] text-text-secondary">
              <span className="font-semibold text-text-primary">500+</span> students active right now
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}