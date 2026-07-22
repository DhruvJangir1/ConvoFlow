import { SignUp } from "@clerk/react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { useAuth } from "../context/AuthContext";
import "./clerk-theme.css";

const clerkAppearance = {
  baseTheme: "#BA2020",
  variables: {
    colorPrimary: "#7C6EF7",
    colorBackground: "#000000",
    colorInputBackground: "rgba(255,255,255,0.04)",
    colorText: "#FFFFFF",
    colorTextSecondary: "#8A8AA0",
    colorInputText: "#F0F0F5",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "mx-auto",
    cardBox: "shadow-2xl",
    card: "bg-black border border-white/[0.08] rounded-2xl",
    headerTitle: "text-white text-2xl font-bold tracking-tight",
    headerSubtitle: "text-[#8A8AA0] text-sm",
    formFieldInput:
      "rounded-xl border border-white/[0.06] bg-white/[0.04] py-3 px-4 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-[#7C6EF7]/50 focus:ring-2 focus:ring-[#7C6EF7]/15",
    formFieldLabel: "text-sm font-medium text-[#8A8AA0]",
    socialButtonsBlockButton:
      "rounded-xl border border-white/[0.06] bg-white/[0.04] text-[#F0F0F5] hover:bg-white/[0.08] transition-all duration-200",
    socialButtonsBlockButtonText: "text-sm font-medium text-[#F0F0F5]",
    dividerLine: "bg-white/[0.06]",
    dividerText: "text-[#55556A] text-xs",
    formButtonPrimary:
      "bg-[#7C6EF7] hover:bg-[#6B5DE8] rounded-xl text-white text-sm font-semibold shadow-lg shadow-[#7C6EF7]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#7C6EF7]/30",
    footer: "bg-black border-t border-white/[0.06] rounded-b-2xl",
    footerActionLink: "text-[#7C6EF7] hover:text-[#9B8FFF] text-sm font-medium",
    footerActionText: "text-[#8A8AA0] text-xs",
    identityPreviewEditButton: "text-[#7C6EF7]",
    formResendCodeLink: "text-[#7C6EF7] hover:text-[#9B8FFF]",
  },
};

export default function SignUpForm() {
  const user = useSelector((s: RootState) => s.userAuth.user);
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7C6EF7] border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="relative flex h-dvh items-center justify-center overflow-y-auto overflow-x-hidden bg-[#09090b] px-4 py-8">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-[128px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-500/10 blur-[128px]" />

      <div className="w-full max-w-md animate-message-in">
        <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 sm:p-8 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.1]">
          <div className="mb-6 flex justify-center">
            <img
              src="/CONVO_FLOW_LOGO.png"
              alt="ConvoFlow"
              className="h-20 w-20 object-contain"
            />
          </div>
          <SignUp
            routing="path"
            path="/signup"
            appearance={clerkAppearance}
          />
        </div>
      </div>
    </div>
  );
}
