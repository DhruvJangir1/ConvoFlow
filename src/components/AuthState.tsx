interface AuthErrorStateProps {
  error: string | null;
  onRetry: () => void;
}

export function AuthSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

export function AuthErrorState({ error, onRetry }: AuthErrorStateProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface-elevated p-6 text-center">
        <p className="text-sm font-semibold text-text-primary">Could not load your account</p>
        <p className="mt-2 text-xs text-text-secondary">{error}</p>
        <button
          onClick={onRetry}
          className="mt-4 cursor-pointer rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-text-primary transition-opacity hover:opacity-90"
          type="button"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
