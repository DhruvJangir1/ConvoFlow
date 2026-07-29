import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';

export default function NotFoundPage() {
  const user = useSelector((s: RootState) => s.userAuth.user);

  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-y-auto overflow-x-hidden bg-surface-base px-4">
      <div className="pointer-events-none absolute -left-20 sm:-left-40 -top-20 sm:-top-40 h-64 w-64 sm:h-96 sm:w-96 rounded-full bg-accent/10 blur-[128px]" />
      <div className="pointer-events-none absolute -bottom-20 sm:-bottom-40 -right-20 sm:-right-40 h-64 w-64 sm:h-96 sm:w-96 rounded-full bg-accent-info/10 blur-[128px]" />

      <span className="mb-4 select-none text-[80px] sm:text-[120px] lg:text-[180px] font-black leading-none tracking-tighter text-white/[0.04]">
        404
      </span>

      <h1 className="mb-2 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-text-primary text-center">
        Page not found
      </h1>

      <p className="mb-8 text-center text-sm sm:text-base text-text-secondary max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>

      <Link
        to={user ? '/home' : '/'}
        className="rounded-xl bg-linear-to-r from-accent-info to-accent px-5 sm:px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:shadow-xl hover:shadow-accent/30"
      >
        Go back to Home
      </Link>
    </div>
  );
}
