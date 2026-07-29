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
      <div className="flex min-h-screen items-center justify-center bg-surface-base">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="relative flex h-dvh items-center justify-center overflow-y-auto overflow-x-hidden bg-surface-base px-4 py-8">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-accent/10 blur-[128px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent-info/10 blur-[128px]" />

      <div className="w-full max-w-md animate-message-in">
        <div className="relative rounded-2xl border border-border bg-surface-elevated/50 p-5 sm:p-8 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-300 hover:border-accent/30 hover:shadow-[0_0_24px_rgba(29,78,216,0.08)]">
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
      card: "bg-surface-elevated",
      headerTitle: "text-text-primary",
      headerSubtitle: "text-text-secondary",
      socialButtonsBlockButton: "bg-surface-raised text-text-primary border-border",
      socialButtonsBlockButtonText: "text-text-primary",
      dividerLine: "bg-border",
      dividerText: "text-text-secondary",
      formFieldLabel: "text-text-primary",
      footer: "bg-surface-elevated border-t border-border",
      footerActionText: "text-text-secondary",
    },
  }}
/>
        </div>
      </div>
    </div>
  );
}
