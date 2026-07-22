import { SignIn } from "@clerk/react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { useAuth } from "../context/AuthContext";
import "./clerk-theme.css";


export default function LoginForm() {
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
          
<SignIn
  appearance={{
    elements: {
      card: "bg-zinc-900",
      headerTitle: "text-black",
      headerSubtitle: "text-zinc-400",
      socialButtonsBlockButton: "bg-zinc-800 text-white border-zinc-700",
      socialButtonsBlockButtonText: "text-white",
      dividerLine: "bg-zinc-700",
      dividerText: "text-zinc-400",
      formFieldLabel: "text-zinc-200",
      footer: "bg-zinc-900 border-t border-zinc-800",
      footerActionText: "text-zinc-400",
    },
  }}
/>
        </div>
      </div>
    </div>
  );
}
