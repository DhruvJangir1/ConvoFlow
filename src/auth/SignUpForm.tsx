import { SignUp } from "@clerk/react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { useAuth } from "../context/AuthContext";
import "./clerk-theme.css";

const clerkAppearance = {
  baseTheme: "#BA2020",
  variables: {
    colorPrimary: "#1D4ED8",
    colorBackground: "#08080C",
    colorInputBackground: "rgba(255,255,255,0.04)",
    colorText: "#EDEDF0",
    colorTextSecondary: "#9494A8",
    colorInputText: "#EDEDF0",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "mx-auto",
    cardBox: "shadow-2xl",
    card: "bg-surface-elevated border border-border rounded-2xl",
    headerTitle: "text-text-primary text-2xl font-bold tracking-tight",
    headerSubtitle: "text-text-secondary text-sm",
    formFieldInput:
      "rounded-xl border border-border bg-surface-raised py-3 px-4 text-sm text-text-primary placeholder-text-muted outline-none transition-all duration-200 focus:border-accent/50 focus:ring-2 focus:ring-accent/15",
    formFieldLabel: "text-sm font-medium text-text-secondary",
    socialButtonsBlockButton:
      "rounded-xl border border-border bg-surface-raised text-text-primary hover:bg-surface-hover transition-all duration-200",
    socialButtonsBlockButtonText: "text-sm font-medium text-text-primary",
    dividerLine: "bg-border",
    dividerText: "text-text-muted text-xs",
    formButtonPrimary:
      "bg-accent hover:bg-accent-hover rounded-xl text-white text-sm font-semibold shadow-lg shadow-accent/20 transition-all duration-200 hover:shadow-xl hover:shadow-accent/30",
    footer: "bg-surface-elevated border-t border-border rounded-b-2xl",
    footerActionLink: "text-accent hover:text-accent-hover text-sm font-medium",
    footerActionText: "text-text-secondary text-xs",
    identityPreviewEditButton: "text-accent",
    formResendCodeLink: "text-accent hover:text-accent-hover",
  },
};

export default function SignUpForm() {
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
