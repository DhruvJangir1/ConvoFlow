import { AuthenticateWithRedirectCallback } from "@clerk/react";

export default function SSOCallbackPage() {
  return (
    <>
      <AuthenticateWithRedirectCallback />
      <div className="relative flex h-dvh items-center justify-center overflow-hidden bg-surface-base">
        <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-accent/10 blur-[128px]" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent-info/10 blur-[128px]" />

        <div className="flex flex-col items-center gap-6">
          <img
            src="/CONVO_FLOW_LOGO.png"
            alt="ConvoFlow"
            className="h-20 w-20 object-contain"
          />
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-xs font-semibold text-text-secondary">
            Completing your sign-in...
          </p>
        </div>
      </div>
    </>
  );
}
