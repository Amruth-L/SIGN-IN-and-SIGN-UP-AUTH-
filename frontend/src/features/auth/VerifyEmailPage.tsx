import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { verifyEmail, resendOtp, getApiError } from './auth.service';
import type { AuthLoadingState } from './auth.types';

const VerifyEmail: React.FC = () => {
  const { api } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const initialEmail: string = (location.state as { email?: string } | null)?.email ?? '';

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingState, setLoadingState] = useState<AuthLoadingState>('idle');
  const [resendCooldown, setResendCooldown] = useState(0);

  const isLoading = loadingState === 'loading';

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoadingState('loading');

    try {
      await verifyEmail(api, { email, otp });
      setSuccess('Email verified! Redirecting to sign in...');
      setLoadingState('success');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
      setError(getApiError(err, 'Verification failed. Please check your code and try again.'));
      setLoadingState('error');
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setError('Please enter your email address first.');
      return;
    }
    setError('');
    setSuccess('');
    setLoadingState('loading');

    try {
      await resendOtp(api, { email: email.trim().toLowerCase() });
      setSuccess('A new code has been sent to your inbox.');
      setResendCooldown(60);
      setLoadingState('idle');
    } catch (err: unknown) {
      setError(getApiError(err, 'Failed to resend code. Please try again.'));
      setLoadingState('error');
    }
  };

  return (
    <div className="[grid-template-columns:1fr]">
      {/* ── Left: Brand panel ── */}
      <aside className="hidden">
        <div className="[font-size:1.375rem] font-extrabold [color:var(--color-text)] [letter-spacing:-0.04em] [margin-bottom:2.5rem] relative">Campus<span>Mesh</span></div>

        <h2 className="[font-size:2rem] font-extrabold [line-height:1.2] [color:var(--color-text)] [letter-spacing:-0.03em] [margin-bottom:1rem] relative">
          One step<br />
          <span>left to go.</span>
        </h2>

        <p className="[font-size:15px] [color:var(--color-text-secondary)] [line-height:1.65] [max-width:320px] [margin-bottom:2.5rem] relative">
          We sent a 6-digit verification code to your DBIT university email.
          Enter it to activate your account.
        </p>

        <ul className="space-y-3 text-sm text-ink/55">
          <li>
            <span className="[width:28px] [height:28px] [background:var(--color-primary-light)] [border-radius:var(--radius-sm)] flex items-center justify-center shrink-0 [color:var(--color-primary-dark)]"><Mail size={14} strokeWidth={2} /></span>
            Check your inbox and spam folder
          </li>
          <li>
            <span className="[width:28px] [height:28px] [background:var(--color-primary-light)] [border-radius:var(--radius-sm)] flex items-center justify-center shrink-0 [color:var(--color-primary-dark)]"><RotateCcw size={14} strokeWidth={2} /></span>
            Code expires in 10 minutes
          </li>
        </ul>
      </aside>

      {/* ── Right: Form panel ── */}
      <main className="[padding:2rem_1.5rem] [padding:1.5rem_1.25rem]">
        <div className="w-full [max-width:400px] [max-width:420px]">
          <div className="[margin-bottom:1.75rem]">
            <h1>Check your inbox</h1>
            <p>
              Enter the 6-digit code sent to{' '}
              {initialEmail ? <strong>{initialEmail}</strong> : 'your university email'}
            </p>
          </div>

          {error && <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</div>}
          {success && <div className="rounded-xl bg-mesh-50 p-3 text-sm font-semibold text-mesh-700" role="status">{success}</div>}

          <form onSubmit={handleVerify} noValidate>
            {/* Email field — only shown if not passed via router state */}
            {!initialEmail && (
              <div className="space-y-4">
                <label className="mb-1.5 block text-xs font-bold text-ink/60" htmlFor="ve-email">University Email</label>
                <div className="space-y-4">
                  <span className="absolute [left:1rem] [font-size:1rem] [color:var(--text-muted)] pointer-events-none"><Mail size={15} strokeWidth={1.75} /></span>
                  <input
                    id="ve-email"
                    type="email"
                    className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 pl-11 text-sm outline-none focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                    placeholder="1DB23AD001@dbit.co.in"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* OTP */}
            <div className="space-y-4">
              <label className="mb-1.5 block text-xs font-bold text-ink/60" htmlFor="ve-otp">Verification Code</label>
              <input
                id="ve-otp"
                type="text"
                className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-center text-xl font-bold tracking-[.4rem] outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                placeholder="Enter 6-digit code"
                required
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <button
              type="submit"
              id="ve-submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white transition hover:bg-mesh-700 disabled:opacity-50"
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading
                ? <><span  /> Verifying...</>
                : 'Verify Email'}
            </button>
          </form>

          {/* Resend section */}
          <div className="mt-5 text-center">
            <p>
              Didn't receive the code?
            </p>
            <button
              type="button"
              className="mt-2 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white transition hover:bg-mesh-700 disabled:opacity-50"
              onClick={handleResend}
              disabled={isLoading || resendCooldown > 0}
              id="ve-resend"
            >
              <RotateCcw size={14} strokeWidth={2} />
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VerifyEmail;
