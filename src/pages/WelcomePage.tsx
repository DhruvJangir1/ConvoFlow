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
    handle: "SarahP",
    content:
      "Just finished that Chem midterm — absolutely brutal. Who else is celebrating with a 3AM cry session?",
    timestamp: "12m ago",
    likes: 24,
    replies: 8,
    hue: 320,
  },
  {
    handle: "MarcusL",
    content:
      "Pro tip: if you use .map() instead of a for loop on that data transformation, you'll cut your runtime in half. Trust me.",
    timestamp: "34m ago",
    likes: 47,
    replies: 12,
    hue: 200,
  },
  {
    handle: "AishaK",
    content:
      "Anyone else's professor just drop a 60-page reading over spring break?? I need a study buddy stat.",
    timestamp: "1h ago",
    likes: 31,
    replies: 15,
    hue: 140,
  },
  {
    handle: "JayT",
    content:
      "Finally got my study group together — we're tackling Calc III this weekend. Who's in?",
    timestamp: "2h ago",
    likes: 19,
    replies: 9,
    hue: 50,
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
      <div className="pointer-events-none absolute right-1/4 top-1/2 h-[550px] w-[550px] -translate-y-1/2 rounded-full bg-accent/20 blur-[200px]" />

      <div className="relative col-span-1 hidden flex-col justify-center overflow-hidden px-8 py-16 lg:flex lg:col-span-6">

        <div className="relative z-10 max-w-xl">
          <div className="mb-2 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-secondary" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-secondary" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.15em] bg-linear-to-r from-accent-secondary to-accent bg-clip-text text-transparent">
              Live community
            </span>
          </div>

          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight">
            <span className="text-text-primary">Your Community.</span>{" "}
            <span className="bg-linear-to-r from-accent via-accent-secondary to-accent-success bg-clip-text text-transparent">
              Log in and connect.
            </span>
          </h1>

          <p className="mt-3 text-lg leading-relaxed text-text-secondary">
            See what your classmates are up to. Dive into a world of shared learning.
          </p>

          <div className="mt-8 flex max-h-[460px] flex-col gap-3 overflow-y-auto pr-2 scrollbar-thin">
            {posts.map((post) => (
              <div
                key={post.handle + post.timestamp}
                className="group rounded-xl border border-border bg-surface-elevated/60 p-4 transition-all duration-300 hover:scale-[1.02]"
                style={{
                  borderColor: `hsla(${post.hue}, 60%, 50%, 0.15)`,
                  boxShadow: `0 0 20px hsla(${post.hue}, 60%, 50%, 0.03)`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `hsla(${post.hue}, 70%, 55%, 0.4)`;
                  e.currentTarget.style.boxShadow = `0 0 30px hsla(${post.hue}, 60%, 50%, 0.1)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `hsla(${post.hue}, 60%, 50%, 0.15)`;
                  e.currentTarget.style.boxShadow = `0 0 20px hsla(${post.hue}, 60%, 50%, 0.03)`;
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white/10 transition-transform duration-300 group-hover:scale-110"
                    style={{ background: avatarGradient(post.handle) }}
                  >
                    {getInitials(post.handle)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-text-primary">
                        @{post.handle}
                      </span>
                      <span className="text-[11px] text-text-muted">{post.timestamp}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                      {post.content}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-5 border-t border-border/50 pt-3">
                  <button className="group/btn flex items-center gap-1.5 text-xs text-text-muted transition-all duration-200 hover:text-accent-secondary">
                    <Heart className="h-3.5 w-3.5 transition-all duration-200 group-hover/btn:scale-125 group-hover/btn:fill-current" />
                    <span>{post.likes}</span>
                  </button>
                  <button className="group/btn flex items-center gap-1.5 text-xs text-text-muted transition-all duration-200 hover:text-accent">
                    <MessageCircle className="h-3.5 w-3.5 transition-all duration-200 group-hover/btn:scale-125" />
                    <span>{post.replies}</span>
                  </button>
                  <button className="group/btn ml-auto flex items-center gap-1.5 text-xs text-text-muted transition-all duration-200 hover:text-accent-success">
                    <Share2 className="h-3.5 w-3.5 transition-all duration-200 group-hover/btn:scale-125" />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            ))}

            <div
              className="rounded-xl border border-border bg-surface-elevated/60 p-4 transition-all duration-300 hover:scale-[1.02]"
              style={{
                borderColor: `hsla(270, 60%, 50%, 0.15)`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `hsla(270, 70%, 55%, 0.4)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `hsla(270, 60%, 50%, 0.15)`;
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <span className="text-xs font-semibold uppercase tracking-[0.08em] bg-linear-to-r from-accent to-accent-secondary bg-clip-text text-transparent">
                  Live Poll
                </span>
              </div>
              <p className="text-sm font-medium text-text-primary">
                What&rsquo;s the hardest subject this semester?
              </p>
              <div className="mt-3 space-y-2.5">
                {pollOptions.map((opt) => (
                  <div key={opt.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">{opt.label}</span>
                      <span className="text-text-muted">{opt.pct}%</span>
                    </div>
                    <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-surface-raised">
                      <div
                        className={`h-full rounded-full bg-linear-to-r ${opt.color} transition-all duration-700 ease-out`}
                        style={{ width: `${opt.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-border/50 pt-3">
                <button className="group/btn flex items-center gap-1.5 text-xs text-text-muted transition-all duration-200 hover:text-accent">
                  <Heart className="h-3.5 w-3.5 transition-all duration-200 group-hover/btn:scale-125 group-hover/btn:fill-current" />
                  <span>18</span>
                </button>
              </div>
            </div>

            <div
              className="rounded-xl border border-border bg-surface-elevated/60 p-4 transition-all duration-300 hover:scale-[1.02]"
              style={{
                borderColor: `hsla(170, 60%, 40%, 0.15)`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `hsla(170, 70%, 45%, 0.4)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `hsla(170, 60%, 40%, 0.15)`;
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {["ZaraM", "JayT", "PriyaR"].map((name) => (
                    <div
                      key={name}
                      className="h-8 w-8 rounded-full border-2 border-surface text-[10px] font-semibold text-white transition-transform duration-200 hover:scale-110"
                      style={{
                        background: avatarGradient(name),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {getInitials(name)}
                    </div>
                  ))}
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-gradient-to-br from-accent to-accent-secondary text-[10px] font-semibold text-white">
                    +12
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text-primary">The Chem Squad</p>
                  <p className="text-xs text-text-muted">24 members &middot; 3 online now</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                <button className="flex items-center gap-1.5 text-xs font-medium transition-all duration-200 hover:scale-105"
                  style={{ color: `hsl(170, 60%, 55%)` }}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Join chat</span>
                </button>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>142 messages today</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 via-accent-secondary/5 to-accent-success/5 p-4 transition-all duration-300 hover:scale-[1.02]">
              <div className="flex items-center gap-3">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent-secondary to-rose-500">
                  <Radio className="h-4 w-4 text-white" />
                  <span className="absolute flex h-8 w-8">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-secondary/30" />
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">
                    Professor Al-Fayed is live
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-text-muted">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-secondary" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-secondary" />
                    </span>
                    Advanced Algorithms forum
                  </p>
                </div>
                <span className="animate-pulse rounded-md bg-accent-secondary/15 px-2 py-1 text-[11px] font-bold text-accent-secondary">
                  LIVE
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-8 rounded-xl border border-border/60 bg-gradient-to-r from-accent/5 via-accent-secondary/5 to-accent-success/5 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[
                  { name: "ZaraM", hue: 300 },
                  { name: "JayT", hue: 50 },
                  { name: "PriyaR", hue: 180 },
                  { name: "AishaK", hue: 140 },
                ].map(({ name, hue }) => (
                  <div
                    key={name}
                    className="h-7 w-7 rounded-full border-2 border-surface"
                    style={{
                      background: `linear-gradient(135deg, hsl(${hue}, 65%, 45%), hsl(${(hue + 80) % 360}, 55%, 35%))`,
                    }}
                  />
                ))}
              </div>
              <div>
                <p className="text-sm font-bold bg-linear-to-r from-accent to-accent-secondary bg-clip-text text-transparent">
                  1,200+
                </p>
                <p className="text-xs text-text-muted">students active now</p>
              </div>
            </div>
            <div className="h-8 w-px bg-gradient-to-b from-accent/20 via-accent-secondary/20 to-transparent" />
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-accent-secondary" />
              <p className="text-sm">
                <span className="font-bold bg-linear-to-r from-accent-secondary to-accent-success bg-clip-text text-transparent">
                  50K+
                </span>{" "}
                <span className="text-text-muted">notes shared</span>
              </p>
            </div>
            <div className="h-8 w-px bg-gradient-to-b from-accent-success/20 via-accent/20 to-transparent" />
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-accent-danger" />
              <p className="text-sm">
                <span className="font-bold text-text-primary">4.9</span>{" "}
                <span className="text-text-muted">rating</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative col-span-1 flex min-h-dvh items-center justify-center px-6 py-12 lg:col-span-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <img src="/CONVO_FLOW_LOGO.png" alt="" className="mx-auto h-12 w-auto" />
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-text-primary">
              Welcome to ConvoFlow
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              The nicest place to talk with the people you love.
            </p>
          </div>

          <div className="relative rounded-2xl border border-border bg-surface-elevated/80 p-10 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-300 hover:border-border-active">
            <div className="mb-10 text-center">
              <div className="mx-auto mb-8 hidden h-24 w-24 items-center justify-center lg:flex">
                <img
                  src="/CONVO_FLOW_LOGO.png"
                  alt="ConvoFlow"
                  className="h-full w-full object-contain"
                />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">
                Get started
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                Create an account or sign in to continue
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => navigate("/signup")}
                className="group relative flex-1 cursor-pointer overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-accent px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all duration-300 hover:shadow-xl hover:shadow-accent/30 active:scale-[0.98]"
              >
                <span className="relative z-10 flex items-center justify-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Sign Up
                </span>
                <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/15 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
              </button>

              <button
                onClick={() => navigate("/login")}
                className="group flex-1 cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-white/80 backdrop-blur-sm transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-[0.98]"
              >
                <span className="flex items-center justify-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  Log In
                </span>
              </button>
            </div>

            <p className="mt-8 text-center text-xs text-text-muted">
              By continuing, you agree to ConvoFlow&apos;s Terms of Service.
            </p>
          </div>

          <div className="mt-4 flex items-center justify-center gap-3 rounded-xl border border-border bg-surface-elevated/40 px-4 py-3 lg:hidden">
            <Sparkles className="h-4 w-4 text-accent-secondary" />
            <p className="text-xs text-text-secondary">
              <span className="font-semibold text-text-primary">500+</span> students active right now
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
