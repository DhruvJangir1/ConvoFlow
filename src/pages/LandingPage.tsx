import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Ban,
  Bell,
  Briefcase,
  Brush,
  Calendar,
  Camera,
  ChevronDown,
  Clock,
  Code2,
  EyeOff,
  FileText,
  Flag,
  Flame,
  Gamepad2,
  GraduationCap,
  Hash,
  Heart,
  Image,
  Lock,
  Map,
  Megaphone,
  MessageCircle,
  Mic,
  Monitor,
  Moon,
  Palette,
  PhoneCall,
  Send,
  Shield,
  Smile,
  Sparkles,
  Star,
  Store,
  Sun,
  ToggleLeft,
  UserCog,
  UserRound,
  Users,
  Video,
  Wallpaper,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { useAuth } from '../context/AuthContext';

const TYPING_DOT = "inline-block h-1 w-1 animate-typing-dot rounded-full bg-zinc-400/60";

const COMMUNITY_BENEFITS = [
  {
    icon: ToggleLeft,
    title: "Post Anonymously on Demand",
    desc: "You always have the option to hide your identity. Flip a switch to hide your name and picture whenever you want to speak freely without anyone knowing who you are.",
  },
  {
    icon: Users,
    title: "Normal Group Chats Too",
    desc: "Gather your school clubs, neighborhood crews, or close friends. Hang out under your regular profile or drop your handle completely—it's always up to you.",
  },
  {
    icon: Flame,
    title: "Zero Setup, Just Talk",
    desc: "No confusing signup steps or bloated settings. Throw an invite link into your current group chat or story, and your friends can jump right into the chat instantly.",
  },
];

const FAQS = [
  {
    q: "How does the anonymous option work?",
    a: "Whenever you want, you can choose to post anonymously in a room. When you turn this option on, your real username, profile picture, and bio are completely hidden, replacing them with a random placeholder so nobody knows who you are."
  },
  {
    q: "Is it completely free?",
    a: "Yep, 100% free. No hidden fees, no subscriptions, and absolutely no ads trying to sell you stuff while you're trying to talk to your friends."
  },
  {
    q: "Do my friends need to install an app to join?",
    a: "Nope! It works straight in any browser on phones, laptops, or tablets. You just send them a link, they click it, and they're in the room with you instantly."
  },
  {
    q: "Can I lock our group chats?",
    a: "Yes. You can make spaces completely private so only people with your direct invite link can see or join the chat."
  }
];

const SECRET_MESAGES = [
  "i tell everyone im fine so much that sometimes i forget i'm not. then 2am hits and i remember",
  "i have a secret that would completely change how my family sees me and i'll probably never tell them",
  "my anxiety has gotten so bad i've started canceling plans i actually wanted to go to. it's easier to just be alone",
];

const LIVE_STATS = [
  { label: "People Online", value: "524K", width: "w-[78%]" },
  { label: "Active Group Spaces", value: "32K", width: "w-[52%]" },
  { label: "Messages This Hour", value: "4.1M", width: "w-[88%]" },
];

const SOCIAL_STATS = [
  { value: "500,000+", label: "users joined" },
  { value: "4.9/5", label: "average app-store rating" },
  { value: "18M+", label: "messages shared monthly" },
  { value: "72K", label: "active communities" },
];

const TESTIMONIALS = [
  {
    name: "Maya",
    role: "Campus club lead",
    quote: "Our group finally moved off five messy chats. Events, announcements, and anonymous check-ins live in one place.",
  },
  {
    name: "Jon",
    role: "Gaming community mod",
    quote: "Roles and report tools make it easier to keep a busy room readable without killing the fun.",
  },
  {
    name: "Sofia",
    role: "Creator community owner",
    quote: "The media sharing and themed channels make the whole space feel like ours, not another generic chat room.",
  },
];

const COMMUNITY_HIGHLIGHTS = [
  "Student unions running weekly events",
  "Gaming squads sharing clips and GIFs",
  "Creator circles hosting announcement channels",
  "Families keeping photos, files, and calls together",
];

const FEATURE_GROUPS = [
  {
    title: "Groups & communities",
    desc: "Structured spaces for fast chats and bigger communities.",
    items: [
      { icon: Users, label: "Group chats" },
      { icon: Hash, label: "Channels" },
      { icon: UserCog, label: "Roles/moderation" },
      { icon: Calendar, label: "Events or announcements" },
    ],
  },
  {
    title: "Media sharing",
    desc: "Everything people already send, organized inside the room.",
    items: [
      { icon: Image, label: "Photos" },
      { icon: Video, label: "Videos" },
      { icon: FileText, label: "Files" },
      { icon: Smile, label: "GIFs and stickers" },
    ],
  },
  {
    title: "Voice & video",
    desc: "Move from text to live conversation without changing tools.",
    items: [
      { icon: Mic, label: "Voice calls" },
      { icon: Camera, label: "Video calls" },
      { icon: Monitor, label: "Screen sharing" },
      { icon: PhoneCall, label: "Group calls" },
    ],
  },
  {
    title: "Privacy & security",
    desc: "Controls people expect before they speak freely.",
    items: [
      { icon: Lock, label: "End-to-end encryption" },
      { icon: Shield, label: "Privacy controls" },
      { icon: Clock, label: "Disappearing messages" },
      { icon: Flag, label: "Block/report tools" },
    ],
  },
  {
    title: "Personalization",
    desc: "Make every space look and feel like the people inside it.",
    items: [
      { icon: Palette, label: "Custom themes" },
      { icon: UserRound, label: "Profile customization" },
      { icon: Sparkles, label: "Custom emojis" },
      { icon: Wallpaper, label: "Chat wallpapers" },
    ],
  },
];

const DEMO_MESSAGES = [
  { author: "Nia", text: "Morning check-in is live. Vote on today's study room.", side: "left" },
  { author: "Kai", text: "Dropping the event flyer and the clips from yesterday.", side: "right" },
  { author: "Mod", text: "Announcement channel is locked until 4 PM.", side: "left" },
  { author: "Anonymous", text: "Can we do a quiet vent room after finals?", side: "left" },
];

const THEMES = [
  {
    label: "Dark",
    shell: "from-[#101018] via-[#09090f] to-[#050505]",
    bubble: "from-blue-600 to-indigo-600",
  },
  {
    label: "Light",
    shell: "from-slate-100 via-white to-blue-50",
    bubble: "from-sky-500 to-blue-600",
  },
  {
    label: "Custom",
    shell: "from-emerald-950 via-zinc-950 to-indigo-950",
    bubble: "from-emerald-500 to-cyan-500",
  },
];

const TRUST_REASONS = [
  "One place for normal chats, private rooms, announcements, media, and calls",
  "Community tools built into the chat instead of bolted on later",
  "Identity controls that let people decide when to be known or anonymous",
];

const COMPARISON_ROWS = [
  { feature: "Anonymous mode", convoflow: "Built in per room", traditional: "Usually missing" },
  { feature: "Community roles", convoflow: "Native roles/mods", traditional: "Limited admin toggles" },
  { feature: "Media + calls", convoflow: "Photos, files, GIFs, calls", traditional: "Split across tools" },
  { feature: "Safety controls", convoflow: "Privacy, block, report", traditional: "Often buried" },
];

const DAY_STEPS = [
  { time: "Morning", title: "Group chat", desc: "Catch up with classmates and family before the day starts.", icon: Sun },
  { time: "Afternoon", title: "Work messages", desc: "Share files, announcements, and quick decisions in channels.", icon: Briefcase },
  { time: "Evening", title: "Video call", desc: "Switch to group calls, screen sharing, and relaxed hangouts.", icon: Moon },
];

const SHOWCASES = [
  { title: "Friends", desc: "Fast chats, photos, stickers, and late-night rooms.", icon: Heart },
  { title: "Teams", desc: "Channels, files, screen sharing, and announcements.", icon: Briefcase },
  { title: "Gaming communities", desc: "Clips, GIFs, roles, events, and moderation.", icon: Gamepad2 },
  { title: "Businesses", desc: "Organized conversations with privacy and control.", icon: Store },
];

const AUDIENCES = [
  { title: "Students", icon: GraduationCap },
  { title: "Creators", icon: Camera },
  { title: "Families", icon: Heart },
  { title: "Teams", icon: Users },
];

function revealStyle(delayMs: number) {
  return { animationDelay: `${delayMs}ms` };
}

export default function LandingPage() {
  const user = useSelector((s: RootState) => s.userAuth.user);
  const { loading } = useAuth();
  const navigate = useNavigate();
  const [activeThemeIndex, setActiveThemeIndex] = useState(0);
  const [demoDraft, setDemoDraft] = useState("");
  const [demoMessages, setDemoMessages] = useState(DEMO_MESSAGES);
  const activeTheme = THEMES[activeThemeIndex];

  useEffect(() => {
    if (!loading && user) {
      navigate('/home', { replace: true });
    }
  }, [user, loading, navigate]);

  function handleCTA() {
    navigate(user ? '/home' : '/welcome');
  }

  function handleDemoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDraft = demoDraft.trim();

    if (!trimmedDraft) {
      return;
    }

    setDemoMessages([
      ...demoMessages,
      { author: "You", text: trimmedDraft, side: "right" },
    ]);
    setDemoDraft("");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <div className="h-6 w-6 animate-spin rounded-full border border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="h-dvh overflow-y-auto scroll-smooth bg-[#050505]">
      {/* ── Fixed header ── */}
      <header className="fixed inset-x-0 top-0 z-50 animate-landing-header border-b border-white/[0.05] bg-[#050505]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
          <div className="group flex items-center gap-2">
            <img src="/CONVO_FLOW_LOGO.png" alt="" className="h-5 w-auto transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-110" />
            <span className="text-xs font-semibold tracking-tight text-white transition-colors duration-300 group-hover:text-blue-200">
              ConvoFlow
            </span>
          </div>

          <button
            onClick={handleCTA}
            className="cursor-pointer rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-[10px] font-semibold text-white shadow-lg shadow-blue-500/15 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 active:scale-[0.97]"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-20 pb-14 sm:pt-24 sm:pb-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-[600px] w-[600px] animate-landing-drift rounded-full bg-blue-500/[0.03] blur-[150px]" />
          <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] animate-landing-drift rounded-full bg-indigo-500/[0.03] blur-[150px]" style={revealStyle(900)} />
        </div>

        <div className="relative mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-xl text-center">
            <div className="mb-4 inline-flex animate-landing-slide-up items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[9px] font-medium text-zinc-400 transition-all duration-300 hover:border-blue-400/30 hover:bg-blue-500/[0.04] hover:text-zinc-200">
              <span className="h-1 w-1 animate-landing-pulse-soft rounded-full bg-blue-500" />
              Group chats with an optional anonymous twist.
            </div>

            <h1 className="animate-landing-slide-up text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl lg:text-3xl" style={revealStyle(90)}>
              Chat with your groups.{" "}
              <span className="bg-linear-to-r from-zinc-100 to-indigo-400 bg-clip-text text-transparent">
                Go anonymous anytime.
              </span>
            </h1>

            <p className="mx-auto mt-3 max-w-md animate-landing-slide-up text-[10px] leading-relaxed text-zinc-300 sm:text-xs" style={revealStyle(180)}>
              A clean, super-fast space for student communities and friend groups. Share normal updates, or opt to hide your identity completely so no one knows who you are.
            </p>
          </div>

          {/* Chat Preview Grid */}
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 lg:grid-cols-3">
            {/* Chat Widget */}
            <div className="group animate-landing-slide-right rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/20 hover:bg-white/[0.025] hover:shadow-2xl hover:shadow-blue-950/30 lg:col-span-2" style={revealStyle(280)}>
              <div className="mb-3 flex items-center gap-2 border-b border-white/[0.04] pb-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-semibold transition-transform duration-300 group-hover:scale-110">
                  🍿
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[11px] font-medium text-white">Late Night Chat 👀</p>
                  <p className="text-[9px] text-zinc-500">7 active right now</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-1.5 w-1.5 animate-landing-pulse-soft rounded-full bg-emerald-500" />
                  <span className="text-[9px] text-zinc-500">public</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex animate-message-in justify-start" style={revealStyle(520)}>
                  <div className="max-w-[85%]">
                    <p className="px-1 text-[9px] font-medium text-purple-400">Leo</p>
                    <div className="rounded-xl rounded-tl-sm bg-white/[0.07] px-2.5 py-1.5 text-[11px] text-zinc-200 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.1]">
                      Who is up for a movie night or gaming this weekend? I'm totally bored.
                    </div>
                    <p className="mt-0.5 px-1 text-[8px] text-zinc-600">11:14 PM</p>
                  </div>
                </div>
                <div className="flex animate-message-in justify-end" style={revealStyle(680)}>
                  <div className="max-w-[85%]">
                    <div className="rounded-xl rounded-tr-sm bg-linear-to-r from-blue-600 to-indigo-600 px-2.5 py-1.5 text-[11px] text-white shadow-lg shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-blue-500/35">
                      I'm down!! Only if we watch something terrible so we can just mess around in chat though 💀
                    </div>
                    <p className="mt-0.5 px-1 text-right text-[8px] text-zinc-600">11:15 PM</p>
                  </div>
                </div>
                
                {/* Private/Confessional Anonymous message example */}
                <div className="flex animate-message-in justify-start" style={revealStyle(840)}>
                  <div className="max-w-[85%]">
                    <div className="flex items-center gap-1 mb-0.5 px-1">
                      <EyeOff className="h-2.5 w-2.5 text-emerald-400" />
                      <p className="text-[9px] font-medium text-emerald-400">Anonymous Ghost</p>
                    </div>
                    <div className="rounded-xl rounded-tl-sm border border-emerald-500/20 bg-emerald-500/[0.03] px-2.5 py-1.5 text-[11px] text-zinc-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-400/35 hover:bg-emerald-500/[0.06]">
                      i'm lowkey losing my mind trying to pass this class. everyone thinks i have it together but i'm completely faking it.
                    </div>
                    <p className="mt-0.5 px-1 text-[8px] text-zinc-600">11:16 PM</p>
                  </div>
                </div>
                
                <div className="flex animate-message-in justify-start" style={revealStyle(1000)}>
                  <div className="flex items-center gap-0.5 rounded-xl rounded-tl-sm bg-white/[0.07] px-2.5 py-2">
                    <span className={TYPING_DOT} style={{ animationDelay: "0ms" }} />
                    <span className={TYPING_DOT} style={{ animationDelay: "200ms" }} />
                    <span className={TYPING_DOT} style={{ animationDelay: "400ms" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Counter */}
            <div className="animate-landing-slide-left rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/20 hover:bg-white/[0.025] hover:shadow-2xl hover:shadow-indigo-950/30" style={revealStyle(360)}>
              <div className="flex items-center gap-1.5 border-b border-white/[0.04] pb-2.5">
                <Sparkles className="h-3 w-3 text-zinc-400" />
                <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-400">
                  What's Happening
                </span>
                <span className="ml-auto flex items-center gap-1 text-[8px] text-emerald-400">
                  <span className="h-1 w-1 animate-landing-pulse-soft rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                {LIVE_STATS.map((stat, idx) => (
                  <div className="group/stat animate-landing-slide-up" key={stat.label} style={revealStyle(560 + idx * 110)}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400 transition-colors duration-300 group-hover/stat:text-zinc-200">{stat.label}</span>
                      <span className="text-[11px] font-semibold text-white">{stat.value}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.04]">
                      <div className={`${stat.width} h-full rounded-full bg-linear-to-r from-blue-500 to-emerald-400 transition-all duration-500 group-hover/stat:w-full`} />
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">Chat Status</span>
                  <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                    Good Vibes Only
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-white/[0.04] pt-3">
                <div className="flex items-center gap-1 text-[8px] text-zinc-600">
                  <span className="h-1 w-1 animate-landing-pulse-soft rounded-full bg-emerald-500" />
                  Incognito mode toggles active across chats
                </div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-8 flex animate-landing-slide-up flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3" style={revealStyle(520)}>
            <button
              onClick={handleCTA}
              className="w-full cursor-pointer rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 px-5 py-2 text-[11px] font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 active:scale-[0.98] sm:w-auto"
            >
              Start hanging out free
            </button>
            <button
              onClick={handleCTA}
              className="w-full cursor-pointer rounded-lg border border-white/[0.08] px-5 py-2 text-[11px] font-semibold text-zinc-300 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.15] hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 sm:w-auto"
            >
              See how it looks
            </button>
          </div>

          <div className="mt-4 animate-landing-fade-in text-center" style={revealStyle(650)}>
            <p className="text-[9px] text-zinc-600">
              Join thousands of people chatting, laughing, and choosing how they link up
            </p>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* ── Benefits ── */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-4 sm:grid-cols-4">
            {SOCIAL_STATS.map((stat, idx) => (
              <div
                className="animate-landing-slide-up rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 text-center backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/20 hover:bg-white/[0.03]"
                key={stat.label}
                style={revealStyle(idx * 90)}
              >
                <p className="text-lg font-bold tracking-tight text-white">{stat.value}</p>
                <p className="mt-1 text-[9px] font-medium uppercase tracking-widest text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {TESTIMONIALS.map((item, idx) => (
              <div
                className="group animate-landing-slide-up rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.12] hover:bg-white/[0.025]"
                key={item.name}
                style={revealStyle(120 + idx * 110)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-emerald-400 text-[10px] font-bold text-white">
                      {item.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-white">{item.name}</p>
                      <p className="text-[9px] text-zinc-500">{item.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 text-blue-300">
                    <Star className="h-2.5 w-2.5 fill-current" />
                    <Star className="h-2.5 w-2.5 fill-current" />
                    <Star className="h-2.5 w-2.5 fill-current" />
                    <Star className="h-2.5 w-2.5 fill-current" />
                    <Star className="h-2.5 w-2.5 fill-current" />
                  </div>
                </div>
                <p className="text-[10px] leading-relaxed text-zinc-400 transition-colors duration-300 group-hover:text-zinc-300">
                  "{item.quote}"
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {COMMUNITY_HIGHLIGHTS.map((highlight, idx) => (
              <div
                className="flex animate-landing-slide-up items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.01] p-3 text-[10px] text-zinc-400 transition-all duration-300 hover:border-emerald-400/20 hover:text-zinc-200"
                key={highlight}
                style={revealStyle(220 + idx * 80)}
              >
                <span className="h-1.5 w-1.5 animate-landing-pulse-soft rounded-full bg-emerald-400" />
                {highlight}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-8 animate-landing-slide-up text-center">
            <h2 className="text-sm font-bold tracking-tight text-white sm:text-base">
              Everything a real community needs
            </h2>
            <p className="mt-1.5 text-[10px] text-zinc-500">
              Groups, channels, media, calls, privacy, and personalization in one place.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            {FEATURE_GROUPS.map((group, idx) => (
              <div
                className="group animate-landing-slide-up rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/20 hover:bg-white/[0.025]"
                key={group.title}
                style={revealStyle(idx * 90)}
              >
                <h3 className="text-[11px] font-semibold text-white">{group.title}</h3>
                <p className="mt-1 text-[9px] leading-relaxed text-zinc-500">{group.desc}</p>
                <div className="mt-4 space-y-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 transition-colors duration-300 group-hover:text-zinc-200" key={item.label}>
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.04] text-blue-300">
                          <Icon className="h-3 w-3" />
                        </div>
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-8 animate-landing-slide-up text-center">
            <h2 className="text-sm font-bold tracking-tight text-white sm:text-base">
              Try the feel before you join
            </h2>
            <p className="mt-1.5 text-[10px] text-zinc-500">
              Animated chat, theme switching, status indicators, notifications, and a send-message demo.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className={`relative animate-landing-slide-right overflow-hidden rounded-2xl border border-white/[0.08] bg-linear-to-br ${activeTheme.shell} p-4 shadow-2xl shadow-black/30 transition-all duration-500`}>
              <div className="pointer-events-none absolute left-5 top-5 flex animate-landing-notification items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.08] px-3 py-2 text-[9px] text-white backdrop-blur-xl">
                <Bell className="h-3 w-3 text-blue-300" />
                New announcement in #events
              </div>

              <div className="ml-auto flex max-h-[360px] max-w-sm flex-col rounded-[2rem] border border-white/[0.1] bg-black/35 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08]">
                      <MessageCircle className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-white">Community Hub</p>
                      <p className="flex items-center gap-1 text-[9px] text-emerald-300">
                        <span className="h-1.5 w-1.5 animate-landing-pulse-soft rounded-full bg-emerald-400" />
                        524K active now
                      </p>
                    </div>
                  </div>
                  <div className="flex -space-x-2">
                    <span className="h-6 w-6 rounded-full border border-black bg-blue-500" />
                    <span className="h-6 w-6 rounded-full border border-black bg-emerald-500" />
                    <span className="h-6 w-6 rounded-full border border-black bg-indigo-500" />
                  </div>
                </div>

                <div className="chat-scrollbar mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {demoMessages.map((message, idx) => {
                    const isOutgoing = message.side === "right";
                    return (
                      <div
                        className={`flex animate-message-in ${isOutgoing ? "justify-end" : "justify-start"}`}
                        key={`${message.author}-${idx}`}
                        style={revealStyle(idx * 120)}
                      >
                        <div className="max-w-[82%]">
                          <p className={`px-1 text-[8px] font-medium ${isOutgoing ? "text-right text-blue-200" : "text-zinc-400"}`}>{message.author}</p>
                          <div className={`rounded-2xl px-3 py-2 text-[10px] leading-relaxed shadow-lg ${isOutgoing ? `bg-linear-to-r ${activeTheme.bubble} text-white` : "bg-white/[0.09] text-zinc-200"}`}>
                            {message.text}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form className="mt-3 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.05] p-2" onSubmit={handleDemoSubmit}>
                  <input
                    aria-label="Send a demo message"
                    className="min-w-0 flex-1 bg-transparent px-2 text-[10px] text-white outline-none placeholder:text-zinc-500"
                    onChange={(event) => setDemoDraft(event.target.value)}
                    placeholder="Send a message"
                    value={demoDraft}
                  />
                  <button
                    className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-zinc-950 transition-transform duration-300 hover:scale-105 active:scale-95"
                    type="submit"
                  >
                    <Send className="h-3 w-3" />
                  </button>
                </form>
              </div>
            </div>

            <div className="animate-landing-slide-left space-y-4">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 backdrop-blur-md">
                <div className="mb-3 flex items-center gap-2">
                  <Brush className="h-3.5 w-3.5 text-blue-300" />
                  <h3 className="text-[11px] font-semibold text-white">Theme switcher</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {THEMES.map((theme, idx) => (
                    <button
                      className={`cursor-pointer rounded-lg border px-2 py-2 text-[10px] font-semibold transition-all duration-300 ${activeThemeIndex === idx ? "border-blue-400/50 bg-blue-500/15 text-white" : "border-white/[0.06] text-zinc-500 hover:border-white/[0.15] hover:text-zinc-200"}`}
                      key={theme.label}
                      onClick={() => setActiveThemeIndex(idx)}
                      type="button"
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 backdrop-blur-md">
                <h3 className="text-[11px] font-semibold text-white">Live presence</h3>
                <div className="mt-3 space-y-2">
                  {["Ari is online", "Devon is screen sharing", "Sam went offline"].map((status, idx) => (
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-[10px] text-zinc-300" key={status}>
                      {status}
                      <span className={`h-1.5 w-1.5 rounded-full ${idx === 2 ? "bg-zinc-500" : "animate-landing-pulse-soft bg-emerald-400"}`} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 backdrop-blur-md">
                <h3 className="text-[11px] font-semibold text-white">Media tray</h3>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {[Image, Video, FileText, Smile, Sparkles].map((Icon, idx) => (
                    <div className="flex aspect-square items-center justify-center rounded-lg bg-white/[0.04] text-zinc-300 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.08]" key={idx}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="animate-landing-slide-right rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 backdrop-blur-md">
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-blue-300">
                <Shield className="h-3 w-3" />
                Why people switch to us
              </span>
              <h2 className="mt-2 text-sm font-bold text-white sm:text-base">Less switching, more actual conversation.</h2>
              <div className="mt-4 space-y-3">
                {TRUST_REASONS.map((reason) => (
                  <div className="flex gap-2 text-[10px] leading-relaxed text-zinc-400" key={reason}>
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                    {reason}
                  </div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-500/[0.08] p-3">
                  <Lock className="h-4 w-4 text-emerald-300" />
                  <p className="mt-2 text-[10px] font-semibold text-white">Security explanation</p>
                  <p className="mt-1 text-[9px] leading-relaxed text-zinc-500">Encrypted rooms, private controls, disappearing messages, and clear block/report actions.</p>
                </div>
                <div className="rounded-xl bg-rose-500/[0.08] p-3">
                  <Ban className="h-4 w-4 text-rose-300" />
                  <p className="mt-2 text-[10px] font-semibold text-white">Safety tools</p>
                  <p className="mt-1 text-[9px] leading-relaxed text-zinc-500">Moderators can slow down rooms, remove abuse, and keep channels useful.</p>
                </div>
              </div>
            </div>

            <div className="animate-landing-slide-left rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-[11px] font-semibold text-white">ConvoFlow vs traditional messaging apps</h3>
                <Code2 className="h-4 w-4 text-zinc-500" />
              </div>
              <div className="space-y-2">
                {COMPARISON_ROWS.map((row) => (
                  <div className="grid grid-cols-[0.8fr_1fr_1fr] gap-2 rounded-lg bg-white/[0.025] p-2 text-[9px]" key={row.feature}>
                    <span className="font-semibold text-zinc-300">{row.feature}</span>
                    <span className="text-emerald-300">{row.convoflow}</span>
                    <span className="text-zinc-500">{row.traditional}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-blue-400/10 bg-blue-500/[0.04] p-3">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-blue-200">
                  <Code2 className="h-3.5 w-3.5" />
                  Developer/API section
                </div>
                <p className="mt-1 text-[9px] leading-relaxed text-zinc-500">
                  Web-first architecture keeps room links, notifications, and future community integrations ready for builders.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative min-h-56 animate-landing-slide-up overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 backdrop-blur-md">
              <div className="mb-4 flex items-center gap-2">
                <Map className="h-4 w-4 text-emerald-300" />
                <h3 className="text-[11px] font-semibold text-white">Community growth map</h3>
              </div>
              <div className="relative h-40 rounded-xl bg-radial-[circle_at_center] from-blue-500/[0.14] via-white/[0.03] to-transparent">
                <span className="absolute left-[18%] top-[35%] h-3 w-3 animate-landing-pulse-soft rounded-full bg-blue-400 shadow-lg shadow-blue-400/40" />
                <span className="absolute left-[42%] top-[20%] h-2.5 w-2.5 animate-landing-pulse-soft rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/40" />
                <span className="absolute left-[62%] top-[54%] h-3.5 w-3.5 animate-landing-pulse-soft rounded-full bg-indigo-400 shadow-lg shadow-indigo-400/40" />
                <span className="absolute left-[78%] top-[30%] h-2 w-2 animate-landing-pulse-soft rounded-full bg-cyan-300 shadow-lg shadow-cyan-300/40" />
              </div>
            </div>

            <div className="animate-landing-slide-up rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 backdrop-blur-md">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-300" />
                <h3 className="text-[11px] font-semibold text-white">User avatars connecting</h3>
              </div>
              <div className="relative h-40">
                <div className="absolute left-1/2 top-1/2 h-px w-32 -translate-x-1/2 bg-linear-to-r from-transparent via-blue-400/40 to-transparent" />
                <div className="absolute left-1/2 top-1/2 h-28 w-px -translate-y-1/2 bg-linear-to-b from-transparent via-emerald-400/40 to-transparent" />
                {["A", "J", "M", "S", "K"].map((letter, idx) => (
                  <div
                    className="absolute flex h-9 w-9 animate-landing-float items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.08] text-[11px] font-bold text-white shadow-xl shadow-black/25"
                    key={letter}
                    style={{ animationDelay: `${idx * 160}ms`, left: `${18 + idx * 16}%`, top: `${idx % 2 === 0 ? 18 : 58}%` }}
                  >
                    {letter}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-8 animate-landing-slide-up text-center">
            <h2 className="text-sm font-bold tracking-tight text-white sm:text-base">Built for every conversation shape</h2>
            <p className="mt-1.5 text-[10px] text-zinc-500">A day with the app, conversation showcases, and the people it serves.</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {DAY_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div
                  className="group animate-landing-slide-up rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/20"
                  key={step.title}
                  style={revealStyle(idx * 110)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">{step.time}</span>
                    <Icon className="h-4 w-4 text-blue-300 transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="mt-3 text-[11px] font-semibold text-white">{step.title}</h3>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">{step.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SHOWCASES.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  className="group animate-landing-slide-up rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.025]"
                  key={item.title}
                  style={revealStyle(160 + idx * 90)}
                >
                  <Icon className="h-4 w-4 text-emerald-300 transition-transform duration-300 group-hover:rotate-[-6deg]" />
                  <h3 className="mt-3 text-[11px] font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-[9px] leading-relaxed text-zinc-500">{item.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 backdrop-blur-md">
            <div className="mb-4 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-blue-300" />
              <h3 className="text-[11px] font-semibold text-white">Built for everyone</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {AUDIENCES.map((audience) => {
                const Icon = audience.icon;
                return (
                  <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-3 text-[10px] font-semibold text-zinc-300 transition-all duration-300 hover:bg-white/[0.06] hover:text-white" key={audience.title}>
                    <Icon className="h-3.5 w-3.5 text-blue-300" />
                    {audience.title}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="animate-landing-slide-up text-center">
            <h2 className="text-sm font-bold tracking-tight text-white sm:text-base">
              Made for communities
            </h2>
            <p className="mt-1.5 text-[10px] text-zinc-500">
              A clean space designed completely around messaging, hanging out, and controlling your identity.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {COMMUNITY_BENEFITS.map((b, idx) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="group animate-landing-slide-up rounded-xl border border-white/[0.06] bg-white/[0.01] px-4 py-5 text-center backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/20 hover:bg-white/[0.025] hover:shadow-xl hover:shadow-blue-950/20"
                  style={revealStyle(120 + idx * 120)}
                >
                  <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-500/20">
                    <Icon className="h-3.5 w-3.5 text-blue-400 transition-transform duration-300 group-hover:-translate-y-0.5" />
                  </div>
                  <h3 className="mt-2.5 text-[11px] font-semibold text-white">
                    {b.title}
                  </h3>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">
                    {b.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* ── Anonymous Lounge Section ── */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:gap-10">
            {/* Widget */}
            <div className="w-full max-w-xs shrink-0 lg:max-w-[280px]">
              <div className="group animate-landing-slide-right rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/20 hover:bg-white/[0.025] hover:shadow-2xl hover:shadow-emerald-950/20">
                <div className="mb-3 flex items-center gap-2 border-b border-white/[0.04] pb-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 transition-transform duration-300 group-hover:scale-110">
                    <EyeOff className="h-3 w-3 text-emerald-400 transition-transform duration-300 group-hover:rotate-[-8deg]" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[11px] font-medium text-white">Secrets 🤫</p>
                    <p className="text-[9px] text-zinc-500">Anonymous Mode &bull; 19 active</p>
                  </div>
                </div>

                {/* Super Private / Raw Confessions Messages */}
                <div className="space-y-2">
                  
                  {SECRET_MESAGES.map((item, idx) => (
                    <div className="flex animate-message-in justify-start" key={item} style={revealStyle(220 + idx * 140)}>
                      <div className="max-w-[90%]">
                        <div className="rounded-xl rounded-tl-sm bg-white/[0.07] px-2.5 py-1.5 text-[11px] text-zinc-200 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.1]">
                          {item}
                        </div>
                        <p className="mt-0.5 px-1 text-[8px] text-zinc-600">9:54 PM</p>
                      </div>
                    </div>
                  ))}

                  <div className="flex animate-message-in justify-start" style={revealStyle(680)}>
                    <div className="flex items-center gap-0.5 rounded-xl rounded-tl-sm bg-white/[0.07] px-2.5 py-2">
                      <span className={TYPING_DOT} style={{ animationDelay: "0ms" }} />
                      <span className={TYPING_DOT} style={{ animationDelay: "200ms" }} />
                      <span className={TYPING_DOT} style={{ animationDelay: "400ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Copy */}
            <div className="flex-1 animate-landing-slide-left text-center lg:text-left" style={revealStyle(120)}>
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-widest uppercase text-emerald-400">
                <EyeOff className="h-2.5 w-2.5" />
                Total Identity Control
              </span>
              <h2 className="mt-1.5 text-sm font-bold tracking-tight text-white sm:text-base">
                Go incognito with one click.
              </h2>
              <p className="mt-2 leading-relaxed text-zinc-400 text-[10px]">
                Sometimes you want your communities to know exactly who you are, and other times you just want to say what's on your mind without worrying about your pictures, handles, or friend circles tracking it. Toggle anonymous posting on and off instantly.
              </p>
              <ul className="mt-3 space-y-1.5 text-[10px] text-zinc-400">
                <li className="flex items-center gap-1.5 justify-center lg:justify-start">
                  <span className="h-0.5 w-0.5 rounded-full bg-zinc-500/60" />
                  Your choice: post normally or drop your name entirely
                </li>
                <li className="flex items-center gap-1.5 justify-center lg:justify-start">
                  <span className="h-0.5 w-0.5 rounded-full bg-zinc-500/60" />
                  No profile trail left behind when posting anonymously
                </li>
                <li className="flex items-center gap-1.5 justify-center lg:justify-start">
                  <span className="h-0.5 w-0.5 rounded-full bg-zinc-500/60" />
                  Perfect for honest vents, real talk, or just letting it out safely
                </li>
              </ul>
              <button
                onClick={handleCTA}
                className="mt-5 cursor-pointer rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 px-5 py-2 text-[11px] font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 active:scale-[0.98]"
              >
                Try optional anonymous posting
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* ── FAQ Section ── */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-8 animate-landing-slide-up text-center">
            <h2 className="text-sm font-bold tracking-tight text-white sm:text-base">
              Common Questions
            </h2>
            <p className="mt-1 text-[10px] text-zinc-500">
              Everything you might want to know about getting started.
            </p>
          </div>

          <div className="space-y-2.5">
            {FAQS.map((faq, idx) => (
              <details 
                key={idx} 
                className="group animate-landing-slide-up rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.025] open:border-blue-400/20 open:bg-blue-500/[0.03] [&_summary::-webkit-details-marker]:hidden"
                style={revealStyle(100 + idx * 90)}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[11px] font-semibold text-white">
                  <span className="transition-colors duration-300 group-hover:text-blue-100">{faq.q}</span>
                  <ChevronDown className="h-3 w-3 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180 group-hover:text-blue-300" />
                </summary>
                <p className="mt-2 animate-landing-fade-in border-t border-white/[0.04] pt-2 text-[10px] leading-relaxed text-zinc-400">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="relative overflow-hidden border-t border-white/[0.05] py-16 sm:py-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 animate-landing-drift rounded-full bg-indigo-500/[0.03] blur-[150px]" />
        </div>

        <div className="relative mx-auto max-w-md animate-landing-slide-up px-6 text-center">
          <h2 className="text-base font-bold tracking-tight text-white sm:text-lg">
            Ready to claim your space?
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-[10px] leading-relaxed text-zinc-400">
            Get your friends online, build your community spaces, and never worry about crowded, annoying timelines again.
          </p>
          <button
            onClick={handleCTA}
            className="mt-6 cursor-pointer rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-2 text-[11px] font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 active:scale-[0.98]"
          >
            Create your free space
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] py-5">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 sm:flex-row">
          <div className="group flex items-center gap-1.5">
            <img src="/CONVO_FLOW_LOGO.png" alt="" className="h-4 w-auto transition-transform duration-300 group-hover:scale-110" />
            <span className="text-[10px] text-zinc-500 transition-colors duration-300 group-hover:text-zinc-300">ConvoFlow</span>
          </div>
          <p className="text-[9px] text-zinc-600">
            &copy; {new Date().getFullYear()} ConvoFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
