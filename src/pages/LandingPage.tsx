import { useNavigate, Navigate } from 'react-router-dom';
import { MessageCircle, Heart, Smile, EyeOff } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { useAuth } from '../context/AuthContext';

const TYPING_DOT = "inline-block h-1.5 w-1.5 animate-pulse-dot rounded-full bg-slate-400/60";

const BENEFITS = [
  {
    icon: MessageCircle,
    title: "Stay close",
    desc: "Life gets busy. A quick voice note, a random thought, a laugh — it's the little things that keep people together.",
  },
  {
    icon: Heart,
    title: "Share freely",
    desc: "Photos that don't disappear, voice notes that sound like you, messages that actually feel like a conversation.",
  },
  {
    icon: Smile,
    title: "Talk your way",
    desc: "One-on-one or with the whole squad. React, reply, or just read along — there's no wrong way to be here.",
  },
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
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="h-dvh overflow-y-auto bg-[#08080c]">
      {/* ── Fixed header ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.04] bg-[#08080c]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <img src="/CONVO_FLOW_LOGO.png" alt="" className="h-8 w-auto" />
            <span className="text-lg font-semibold tracking-tight text-white">
              ConvoFlow
            </span>
          </div>

          <button
            onClick={handleCTA}
            className="cursor-pointer rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/15 transition-all hover:shadow-xl hover:shadow-blue-500/25 active:scale-[0.97]"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-28 pb-20 sm:pt-36 sm:pb-28">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[128px]" />
          <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[128px]" />
        </div>

        {/* ── Campus Pulse sidebar ── */}
        <div className="absolute left-6 top-1/3 hidden -translate-y-1/2 lg:block xl:left-16">
          <div className="w-52 space-y-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-6 backdrop-blur-md shadow-xl shadow-black/30">
            <div className="flex items-center gap-2.5 text-xs font-bold tracking-widest uppercase text-slate-300">
              <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span className="absolute h-2.5 w-2.5 rounded-full bg-blue-500 animate-ping" />
                <span className="relative h-2 w-2 rounded-full bg-blue-500" />
              </span>
              Campus Pulse
            </div>
            <div className="space-y-4">
              <div className="group flex items-center gap-3.5 transition-all duration-300 hover:translate-x-1.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15">
                  <svg className="h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">12 students</p>
                  <p className="text-[11px] text-slate-500">in #Finals-Prep</p>
                </div>
              </div>
              <div className="group flex items-center gap-3.5 transition-all duration-300 hover:translate-x-1.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
                  <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">Library</p>
                  <p className="text-[11px] text-slate-500">Active — 43 online</p>
                </div>
              </div>
              <div className="group flex items-center gap-3.5 transition-all duration-300 hover:translate-x-1.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                  <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">8 study groups</p>
                  <p className="text-[11px] text-slate-500">online now</p>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-white/[0.05]">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                campus active
              </div>
            </div>
          </div>
        </div>

        {/* ── Classroom Link indicator (right) ── */}
        <div className="absolute right-6 top-[22%] hidden -translate-y-1/2 lg:block xl:right-16">
          <div className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 backdrop-blur-sm transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.03] hover:translate-x-[-4px] cursor-pointer">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
              <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-200">Join your class group</p>
              <p className="text-[10px] text-slate-500">in one click</p>
            </div>
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            {/* Eyebrow */}
            <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-1.5 text-xs font-medium text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              Private messaging, made simple
            </div>

            {/* Headline */}
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
              Real-time conversations,{" "}
              <span className="bg-linear-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                reimagined.
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              The nicest place to talk with the people you love. Fast, private,
              and feels like home.
            </p>

            {/* ── Chat widget — small, warm, relatable ── */}
            <div className="mx-auto mt-12 max-w-xs sm:mt-14">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm sm:p-5">
                {/* Widget header */}
                <div className="mb-3 flex items-center gap-2.5 border-b border-white/[0.04] pb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-500/20 text-xs font-semibold text-pink-400">
                    L
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-white">Lena</p>
                    <p className="text-[11px] text-slate-500">Online</p>
                  </div>
                  <div className="flex -space-x-1">
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-2.5">
                  <div className="flex justify-start">
                    <div className="max-w-[90%]">
                      <div className="animate-glow-blue rounded-2xl rounded-tl-sm bg-white/[0.07] px-3.5 py-2 text-sm text-slate-200">
                        Are we still on for coffee tomorrow? ☕
                      </div>
                      <p className="mt-0.5 px-1 text-[10px] text-slate-600">9:42 AM</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[90%]">
                      <div className="animate-glow-blue rounded-2xl rounded-tr-sm bg-linear-to-r from-blue-600 to-indigo-600 px-3.5 py-2 text-sm text-white shadow-lg shadow-blue-500/20">
                        Yes! 10am at that new place on 5th?
                      </div>
                      <p className="mt-0.5 px-1 text-right text-[10px] text-slate-600">9:43 AM</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[90%]">
                      <div className="animate-glow-blue rounded-2xl rounded-tl-sm bg-white/[0.07] px-3.5 py-2 text-sm text-slate-200">
                        Perfect, see you there! 🎉
                      </div>
                      <p className="mt-0.5 px-1 text-[10px] text-slate-600">9:44 AM</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white/[0.07] px-3.5 py-2.5">
                      <span className={TYPING_DOT} style={{ animationDelay: "0ms" }} />
                      <span className={TYPING_DOT} style={{ animationDelay: "200ms" }} />
                      <span className={TYPING_DOT} style={{ animationDelay: "400ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── CTA ── */}
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <button
                onClick={handleCTA}
                className="w-full cursor-pointer rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98] sm:w-auto"
              >
                Start chatting free
              </button>
              <button
                onClick={handleCTA}
                className="w-full cursor-pointer rounded-xl border border-white/[0.08] px-8 py-3.5 text-sm font-semibold text-slate-300 transition-all hover:border-white/[0.15] hover:bg-white/[0.03] sm:w-auto"
              >
                See how it works
              </button>
            </div>

            {/* ── Social proof + referral ── */}
            <div className="mt-6 space-y-2">
              <p className="text-xs text-slate-600">
                Join thousands of people who chat here every day
              </p>
              <p className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.04] bg-white/[0.015] px-3 py-1 text-[10px] text-slate-500">
                <svg className="h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
                Invite your study squad — setup takes 30 seconds
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* ── Benefits ── */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Built for the conversations that matter
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              No dashboards, no workflows. Just you and the people you care about.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="rounded-2xl border border-white/[0.04] bg-white/[0.01] px-6 py-8 text-center transition-all hover:border-white/[0.08] hover:bg-white/[0.02]"
                >
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">
                    {b.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {b.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* ── Anonymous group chats section ── */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center gap-14 lg:flex-row lg:gap-20">
            {/* Widget */}
            <div className="w-full max-w-xs shrink-0 lg:max-w-sm">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm sm:p-5">
                {/* Group header */}
                <div className="mb-3 flex items-center gap-2.5 border-b border-white/[0.04] pb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
                    <EyeOff className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-white">Unplugged</p>
                    <p className="text-[11px] text-slate-500">Anonymous &bull; 12 online</p>
                  </div>
                </div>

                {/* Messages — no identifiers, just voices */}
                <div className="space-y-2.5">
                  <div className="flex justify-start">
                    <div className="max-w-[90%]">
                      <div className="rounded-2xl rounded-tl-sm bg-white/[0.07] px-3.5 py-2 text-sm text-slate-200">
                        Anyone else feel like this month just disappeared?
                      </div>
                      <p className="mt-0.5 px-1 text-[10px] text-slate-600">9:52 PM</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[90%]">
                      <div className="rounded-2xl rounded-tl-sm bg-white/[0.07] px-3.5 py-2 text-sm text-slate-200">
                        100%. I blinked and it was June 😅
                      </div>
                      <p className="mt-0.5 px-1 text-[10px] text-slate-600">9:53 PM</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[90%]">
                      <div className="rounded-2xl rounded-tl-sm bg-white/[0.07] px-3.5 py-2 text-sm text-slate-200">
                        Honestly needed to hear I'm not alone in that 🙌
                      </div>
                      <p className="mt-0.5 px-1 text-[10px] text-slate-600">9:54 PM</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white/[0.07] px-3.5 py-2.5">
                      <span className={TYPING_DOT} style={{ animationDelay: "0ms" }} />
                      <span className={TYPING_DOT} style={{ animationDelay: "200ms" }} />
                      <span className={TYPING_DOT} style={{ animationDelay: "400ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Copy */}
            <div className="max-w-lg text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-emerald-400">
                <EyeOff className="h-3.5 w-3.5" />
                Anonymous rooms
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                No labels, just voices.
              </h2>
              <p className="mt-4 leading-relaxed text-slate-400">
                Sometimes you just want to be heard without having to explain who
                you are. Jump into an anonymous group where nobody knows your
                name — only what you say matters.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-400">
                <li className="flex items-center gap-2.5">
                  <span className="h-1 w-1 rounded-full bg-slate-500/60" />
                  No names, no profiles — just your words
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="h-1 w-1 rounded-full bg-slate-500/60" />
                  Leave anytime, nobody will know it was you
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="h-1 w-1 rounded-full bg-slate-500/60" />
                  What's said here, stays here
                </li>
              </ul>
              <button
                onClick={handleCTA}
                className="mt-8 cursor-pointer rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
              >
                Try an anonymous room
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="relative overflow-hidden border-t border-white/[0.04] py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.04] blur-[128px]" />
        </div>

        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to start chatting?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-slate-400">
            It's free, it's private, and it's the loveliest place to talk.
          </p>
          <button
            onClick={handleCTA}
            className="mt-10 cursor-pointer rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-10 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/35 active:scale-[0.98]"
          >
            Create your free account
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.04] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <img src="/CONVO_FLOW_LOGO.png" alt="" className="h-6 w-auto" />
            <span className="text-sm text-slate-500">ConvoFlow</span>
          </div>
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} ConvoFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
