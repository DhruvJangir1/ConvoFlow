import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useSelector } from "react-redux";
import { useUser } from "@clerk/react";
import type { RootState } from "../store/store";
import { useAuth } from "../context/AuthContext";
import ContinueWithConvoFlow, { type OAuthProviderName } from "./ContinueWithConvoFlow";
import SSOCallbackPage from "./SSOCallbackPage";


export default function LoginForm() {
  const user = useSelector((s: RootState) => s.userAuth.user);
  const { user: clerkUser } = useUser();
  const { loading } = useAuth();
  const [selectedProvider, setSelectedProvider] = useState<OAuthProviderName | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (clerkUser || user) {
    return <Navigate to="/home" replace />;
  }

  if (selectedProvider) {
    return <SSOCallbackPage />;
  }

  return (
    <div className="relative flex h-dvh items-center justify-center overflow-y-auto overflow-x-hidden bg-surface-base px-4 py-8">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-accent/10 blur-[128px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent-info/10 blur-[128px]" />

      <div className="w-full max-w-116 animate-message-in">
        <div className="relative flex min-h-120 flex-col justify-center rounded-2xl border border-border bg-surface-elevated/50 p-6 sm:p-10 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-300 hover:border-accent/30 hover:shadow-[0_0_24px_rgba(29,78,216,0.08)]">
          <Link
            to="/"
            className="group absolute left-6 top-5 flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-text-secondary transition-all duration-200 hover:-translate-x-0.5 hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            Back to Home
          </Link>

          <div className="mb-6 flex justify-center">
            <img
              src="/CONVO_FLOW_LOGO.png"
              alt="ConvoFlow"
              className="h-20 w-20 object-contain"
            />
          </div>
          
          <ContinueWithConvoFlow onProviderClick={setSelectedProvider} />
        </div>
      </div>
    </div>
  );
}
