import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, CheckCircle, RefreshCw } from 'lucide-react';

const TOTAL_DIGITS = 6;
const VERIFICATION_SECONDS = 15 * 60;
const RESEND_COOLDOWN_SECONDS = 30;
const REDIRECT_DELAY_MS = 700;

async function parseError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body.error ?? fallback;
}

export default function VerificationPage() {
  const navigate = useNavigate();
  const { email: paramEmail } = useParams();
  const { refreshSession } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(TOTAL_DIGITS).fill(''));
  const [email, setEmail] = useState(paramEmail ? decodeURIComponent(paramEmail) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(VERIFICATION_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verified, setVerified] = useState(false);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // Single interval drives both countdowns
  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft(s => Math.max(0, s - 1));
      setResendCooldown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const timeDisplay = useMemo(() => {
    const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
    const s = (secondsLeft % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, [secondsLeft]);

  function focusAt(idx: number) {
    inputsRef.current[idx]?.focus();
  }

  function handleDigitChange(idx: number, val: string) {
    const cleaned = val.replace(/\D/g, '').slice(0, 1);
    setError(null);
    setDigits(prev => {
      const next = [...prev];
      next[idx] = cleaned;
      return next;
    });
    if (cleaned) focusAt(idx + 1);
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[idx]) focusAt(idx - 1);
    if (e.key === 'ArrowLeft') focusAt(idx - 1);
    if (e.key === 'ArrowRight') focusAt(idx + 1);
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, TOTAL_DIGITS);
    if (!pasted) return;
    const next = Array.from({ length: TOTAL_DIGITS }, (_, i) => pasted[i] ?? '');
    setDigits(next);
    const firstEmpty = next.findIndex(c => !c);
    focusAt(firstEmpty === -1 ? TOTAL_DIGITS - 1 : firstEmpty);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== TOTAL_DIGITS) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/UserVerificaitonRouter/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        setError(await parseError(res, 'Verification failed'));
        return;
      }

      setVerified(true);
      setMessage('Verified! Redirecting...');

      try {
        await refreshSession();
      } catch {
        // best-effort: if refresh fails, still navigate so user can retry login
      }

      setTimeout(() => navigate('/home'), REDIRECT_DELAY_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) {
      setError('Please provide your email to resend the code');
      return;
    }
    if (resendCooldown > 0) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/UserVerificaitonRouter/resend-verification', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        setError(await parseError(res, 'Resend failed'));
        return;
      }

      setMessage('Verification code resent — check your inbox or spam folder');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setSecondsLeft(VERIFICATION_SECONDS);
      setDigits(Array(TOTAL_DIGITS).fill(''));
      focusAt(0);
    } catch {
      setError('Failed to resend verification code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-dvh overflow-y-auto flex items-center justify-center bg-[#09090b] px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-white/[0.06] bg-white/[0.02] p-8 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 p-3 text-white">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Verify your email</h2>
            <p className="text-sm text-slate-400">
              Enter the 6-digit code we sent to{' '}
              <span className="font-medium text-white">{email || 'your email'}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} onPaste={handlePaste} className="mt-6 space-y-4">
          <div className="flex items-center justify-center gap-3">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={el => { inputsRef.current[idx] = el; }}
                value={digit}
                onChange={e => handleDigitChange(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                className="h-14 w-12 rounded-lg bg-white/[0.03] text-center text-lg font-medium text-white outline-none border border-white/[0.04] focus:border-blue-500"
                inputMode="numeric"
                type="text"
                maxLength={1}
                pattern="[0-9]"
                aria-label={`Digit ${idx + 1}`}
              />
            ))}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && (
            <p className="text-sm text-green-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />{message}
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Code expires in <span className="text-white">{timeDisplay}</span>
            </p>
            <div className="flex items-center gap-2">
              {!paramEmail && (
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="rounded-xl bg-white/[0.03] py-2 px-3 text-sm text-white"
                  placeholder="your email"
                  inputMode="email"
                />
              )}
              <button
                type="button"
                onClick={handleResend}
                disabled={loading || resendCooldown > 0}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                  resendCooldown > 0 ? 'bg-white/[0.03] text-slate-400' : 'bg-blue-600 text-white'
                }`}
              >
                <RefreshCw className="h-4 w-4" />
                {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend'}
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={loading || verified || digits.some(d => !d)}
              className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white font-semibold disabled:opacity-60"
            >
              {verified ? 'Verified' : loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}