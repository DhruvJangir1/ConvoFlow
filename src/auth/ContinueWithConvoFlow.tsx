import { useSignIn } from "@clerk/react/legacy";
import { useUser } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import type { ReactElement } from "react";

const OAUTH_PROVIDERS = [
  { strategy: "oauth_google", label: "Continue with Google", name: "google" },
  { strategy: "oauth_microsoft", label: "Continue with Microsoft", name: "microsoft" },
] as const;

type OAuthStrategy = (typeof OAUTH_PROVIDERS)[number]["strategy"];

function GoogleIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function MicrosoftIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

const PROVIDER_ICONS: Record<OAuthStrategy, () => ReactElement> = {
  oauth_google: GoogleIcon,
  oauth_microsoft: MicrosoftIcon,
};

export default function ContinueWithConvoFlow() {
  const { signIn } = useSignIn();
  const { user } = useUser();
  const navigate = useNavigate();

  async function handleOAuth(strategy: OAuthStrategy) {
    if (!signIn) return;
    if (user) {
      navigate('/home');
      return;
    }
    try {
      await signIn.authenticateWithRedirect({ // this is basically a clerk sign in component's execution
        strategy,
         redirectUrl: `${window.location.origin}/sso-callback`,
         redirectUrlComplete: `${window.location.origin}/home`,
      });
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">
          Continue to ConvoFlow
        </h2>
        <p className="mt-1.5 text-xs text-text-secondary">
          Sign in, or create your account. New accounts start free, no card required.
        </p>
      </div>

      <div className="space-y-3">
        {OAUTH_PROVIDERS.map((provider) => {
          const Icon = PROVIDER_ICONS[provider.strategy];
          return (
            <button
              key={provider.strategy}
              onClick={() => handleOAuth(provider.strategy)}
              className="group flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-border bg-surface-raised px-5 py-2.5 text-xs font-semibold text-text-primary transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:bg-surface-hover hover:shadow-lg hover:shadow-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 active:scale-[0.98]"
            >
              <Icon />
              {provider.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 text-center text-[10px] text-text-muted">
        By continuing you agree to our Terms and Privacy Policy.
      </div>
    </div>
  );
}
