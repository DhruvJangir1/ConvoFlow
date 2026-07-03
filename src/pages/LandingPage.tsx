import { useNavigate, Navigate } from 'react-router-dom';
import {
EyeOff, Users, Flame, Sparkles, ChevronDown, ToggleLeft
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

export default function LandingPage() {
  const user = useSelector((s: RootState) => s.userAuth.user);
  const { loading } = useAuth();
  const navigate = useNavigate();

  function handleCTA() {
    navigate(user ? '/home' : '/welcome');
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
    <div className="h-dvh overflow-y-auto bg-[#050505]">
      {/* ── Fixed header ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.05] bg-[#050505]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <img src="/CONVO_FLOW_LOGO.png" alt="" className="h-5 w-auto" />
            <span className="text-xs font-semibold tracking-tight text-white">
              ConvoFlow
            </span>
          </div>

          <button
            onClick={handleCTA}
            className="cursor-pointer rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-[10px] font-semibold text-white shadow-lg shadow-blue-500/15 transition-all hover:shadow-xl hover:shadow-blue-500/25 active:scale-[0.97]"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-20 pb-14 sm:pt-24 sm:pb-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-blue-500/[0.03] blur-[150px]" />
          <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-indigo-500/[0.03] blur-[150px]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-xl text-center">
            <div className="mb-4 inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[9px] font-medium text-zinc-400">
              <span className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />
              Group chats with an optional anonymous twist.
            </div>

            <h1 className="text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl lg:text-3xl">
              Chat with your groups.{" "}
              <span className="bg-linear-to-r from-zinc-100 to-indigo-400 bg-clip-text text-transparent">
                Go anonymous anytime.
              </span>
            </h1>

            <p className="mx-auto mt-3 max-w-md text-[10px] leading-relaxed text-zinc-300 sm:text-xs">
              A clean, super-fast space for student communities and friend groups. Share normal updates, or opt to hide your identity completely so no one knows who you are.
            </p>
          </div>

          {/* Chat Preview Grid */}
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 lg:grid-cols-3">
            {/* Chat Widget */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5 backdrop-blur-md lg:col-span-2">
              <div className="mb-3 flex items-center gap-2 border-b border-white/[0.04] pb-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-semibold">
                  🍿
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[11px] font-medium text-white">Late Night Chat 👀</p>
                  <p className="text-[9px] text-zinc-500">7 active right now</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[9px] text-zinc-500">public</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-start">
                  <div className="max-w-[85%]">
                    <p className="px-1 text-[9px] font-medium text-purple-400">Leo</p>
                    <div className="rounded-xl rounded-tl-sm bg-white/[0.07] px-2.5 py-1.5 text-[11px] text-zinc-200">
                      Who is up for a movie night or gaming this weekend? I'm totally bored.
                    </div>
                    <p className="mt-0.5 px-1 text-[8px] text-zinc-600">11:14 PM</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[85%]">
                    <div className="rounded-xl rounded-tr-sm bg-linear-to-r from-blue-600 to-indigo-600 px-2.5 py-1.5 text-[11px] text-white shadow-lg shadow-blue-500/20">
                      I'm down!! Only if we watch something terrible so we can just mess around in chat though 💀
                    </div>
                    <p className="mt-0.5 px-1 text-right text-[8px] text-zinc-600">11:15 PM</p>
                  </div>
                </div>
                
                {/* Private/Confessional Anonymous message example */}
                <div className="flex justify-start">
                  <div className="max-w-[85%]">
                    <div className="flex items-center gap-1 mb-0.5 px-1">
                      <EyeOff className="h-2.5 w-2.5 text-emerald-400" />
                      <p className="text-[9px] font-medium text-emerald-400">Anonymous Ghost</p>
                    </div>
                    <div className="rounded-xl rounded-tl-sm border border-emerald-500/20 bg-emerald-500/[0.03] px-2.5 py-1.5 text-[11px] text-zinc-200">
                      i'm lowkey losing my mind trying to pass this class. everyone thinks i have it together but i'm completely faking it.
                    </div>
                    <p className="mt-0.5 px-1 text-[8px] text-zinc-600">11:16 PM</p>
                  </div>
                </div>
                
                <div className="flex justify-start">
                  <div className="flex items-center gap-0.5 rounded-xl rounded-tl-sm bg-white/[0.07] px-2.5 py-2">
                    <span className={TYPING_DOT} style={{ animationDelay: "0ms" }} />
                    <span className={TYPING_DOT} style={{ animationDelay: "200ms" }} />
                    <span className={TYPING_DOT} style={{ animationDelay: "400ms" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Counter */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5 backdrop-blur-md">
              <div className="flex items-center gap-1.5 border-b border-white/[0.04] pb-2.5">
                <Sparkles className="h-3 w-3 text-zinc-400" />
                <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-400">
                  What's Happening
                </span>
                <span className="ml-auto flex items-center gap-1 text-[8px] text-emerald-400">
                  <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">People Online</span>
                  <span className="text-[11px] font-semibold text-white">524</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">Active Group Spaces</span>
                  <span className="text-[11px] font-semibold text-white">32</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">Messages This Hour</span>
                  <span className="text-[11px] font-semibold text-white">4,120</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">Chat Status</span>
                  <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                    Good Vibes Only
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-white/[0.04] pt-3">
                <div className="flex items-center gap-1 text-[8px] text-zinc-600">
                  <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                  Incognito mode toggles active across chats
                </div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
            <button
              onClick={handleCTA}
              className="w-full cursor-pointer rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 px-5 py-2 text-[11px] font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98] sm:w-auto"
            >
              Start hanging out free
            </button>
            <button
              onClick={handleCTA}
              className="w-full cursor-pointer rounded-lg border border-white/[0.08] px-5 py-2 text-[11px] font-semibold text-zinc-300 transition-all hover:border-white/[0.15] hover:bg-white/[0.03] sm:w-auto"
            >
              See how it looks
            </button>
          </div>

          <div className="mt-4 text-center">
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
          <div className="text-center">
            <h2 className="text-sm font-bold tracking-tight text-white sm:text-base">
              Made for communities
            </h2>
            <p className="mt-1.5 text-[10px] text-zinc-500">
              A clean space designed completely around messaging, hanging out, and controlling your identity.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {COMMUNITY_BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.01] px-4 py-5 text-center backdrop-blur-md transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.02]"
                >
                  <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                    <Icon className="h-3.5 w-3.5 text-blue-400" />
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
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5 backdrop-blur-md">
                <div className="mb-3 flex items-center gap-2 border-b border-white/[0.04] pb-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
                    <EyeOff className="h-3 w-3 text-emerald-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[11px] font-medium text-white">Secrets 🤫</p>
                    <p className="text-[9px] text-zinc-500">Anonymous Mode &bull; 19 active</p>
                  </div>
                </div>

                {/* Super Private / Raw Confessions Messages */}
                <div className="space-y-2">
                  
                  {SECRET_MESAGES.map(item => (
                    <div className="flex justify-start" key={item}>
                      <div className="max-w-[90%]">
                        <div className="rounded-xl rounded-tl-sm bg-white/[0.07] px-2.5 py-1.5 text-[11px] text-zinc-200">
                          {item}
                        </div>
                        <p className="mt-0.5 px-1 text-[8px] text-zinc-600">9:54 PM</p>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-start">
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
            <div className="flex-1 text-center lg:text-left">
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
                className="mt-5 cursor-pointer rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 px-5 py-2 text-[11px] font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
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
          <div className="text-center mb-8">
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
                className="group rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5 backdrop-blur-md [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between text-[11px] font-semibold text-white list-none">
                  <span>{faq.q}</span>
                  <ChevronDown className="h-3 w-3 text-zinc-400 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-[10px] leading-relaxed text-zinc-400 border-t border-white/[0.04] pt-2">
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
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.03] blur-[150px]" />
        </div>

        <div className="relative mx-auto max-w-md px-6 text-center">
          <h2 className="text-base font-bold tracking-tight text-white sm:text-lg">
            Ready to claim your space?
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-[10px] leading-relaxed text-zinc-400">
            Get your friends online, build your community spaces, and never worry about crowded, annoying timelines again.
          </p>
          <button
            onClick={handleCTA}
            className="mt-6 cursor-pointer rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-2 text-[11px] font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
          >
            Create your free space
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] py-5">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 sm:flex-row">
          <div className="flex items-center gap-1.5">
            <img src="/CONVO_FLOW_LOGO.png" alt="" className="h-4 w-auto" />
            <span className="text-[10px] text-zinc-500">ConvoFlow</span>
          </div>
          <p className="text-[9px] text-zinc-600">
            &copy; {new Date().getFullYear()} ConvoFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}