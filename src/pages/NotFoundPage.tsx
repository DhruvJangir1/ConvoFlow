import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';

export default function NotFoundPage() {
  const user = useSelector((s: RootState) => s.userAuth.user);

  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-y-auto overflow-x-hidden bg-[#09090b] px-4">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-[128px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-500/10 blur-[128px]" />

      <span className="mb-4 select-none text-[120px] font-black leading-none tracking-tighter text-white/[0.04] sm:text-[180px]">
        404
      </span>

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Page not found
      </h1>

      <p className="mb-8 text-center text-slate-400">
        The page you're looking for doesn't exist or has been moved.
      </p>

      <Link
        to={user ? '/home' : '/'}
        className="rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/30"
      >
        Go back to Home
      </Link>
    </div>
  );
}
