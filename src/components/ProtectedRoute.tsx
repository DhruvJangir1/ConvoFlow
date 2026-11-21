import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { useAuth } from '../context/AuthContext';
import { AuthErrorState, AuthSpinner } from './AuthState';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useSelector((s: RootState) => s.userAuth.user);
  const { status, loading, error, retry } = useAuth();

  if (loading) {
    return <AuthSpinner />;
  }

  if (status === 'signed-out') {
    return <Navigate to="/auth" replace />;
  }

  if (status === 'error' || user === null) {
    return <AuthErrorState error={error} onRetry={retry} />;
  }

  return <>{children}</>;
}
