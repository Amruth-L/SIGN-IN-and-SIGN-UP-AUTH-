import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { requestPasswordReset, resetPassword, getApiError } from './auth.service';
import type { AuthLoadingState } from './auth.types';

const ForgotPassword: React.FC = () => {
  const { api } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingState, setLoadingState] = useState<AuthLoadingState>('idle');

  const isLoading = loadingState === 'loading';

  // ── Step 1: Request OTP ──
  const handleRequestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoadingState('loading');

    try {
      const res = await requestPasswordReset(api, { email: email.trim().toLowerCase() });
      setSuccess(res.message || 'Reset code sent. Check your inbox.');
      setLoadingState('success');
      setStep(2);
    } catch (err: unknown) {
      setError(getApiError(err, 'Failed to send reset code. Please try again.'));
      setLoadingState('error');
    }
  };

  // ── Step 2: Reset Password ──
  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoadingState('loading');

    try {
      const res = await resetPassword(api, {
        email: email.trim().toLowerCase(),
        otp,
        newPassword,
      });
      setSuccess(res.message || 'Password reset successfully!');
      setLoadingState('success');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
      setError(getApiError(err, 'Failed to reset password. Please check your code and try again.'));
      setLoadingState('error');
    }
  };

  return (
    <div className="[grid-template-columns:1fr]">
      {/* ── Left: Brand panel ── */}
      <aside className="hidden">
        <div className="[font-size:1.375rem] font-extrabold [color:var(--color-text)] [letter-spacing:-0.04em] [margin-bottom:2.5rem] relative">Campus<span>Mesh</span></div>

        <h2 className="[font-size:2rem] font-extrabold [line-height:1.2] [color:var(--color-text)] [letter-spacing:-0.03em] [margin-bottom:1rem] relative">
          Forgot your<br />
          <span>password?</span>
        </h2>

        <p className="[font-size:15px] [color:var(--color-text-secondary)] [line-height:1.65] [max-width:320px] [margin-bottom:2.5rem] relative">
          No problem. Enter your DBIT university email and we'll
          send you a one-time reset code.
        </p>

        <ul className="space-y-3 text-sm text-ink/55">
          <li>
            <span className="[width:28px] [height:28px] [background:var(--color-primary-light)] [border-radius:var(--radius-sm)] flex items-center justify-center shrink-0 [color:var(--color-primary-dark)]"><Mail size={14} strokeWidth={2} /></span>
            Code sent to your university email
          </li>
          <li>
            <span className="[width:28px] [height:28px] [background:var(--color-primary-light)] [border-radius:var(--radius-sm)] flex items-center justify-center shrink-0 [color:var(--color-primary-dark)]"><Lock size={14} strokeWidth={2} /></span>
            Code expires in 10 minutes
          </li>
        </ul>
      </aside>

      {/* ── Right: Form panel ── */}
      <main className="[padding:2rem_1.5rem] [padding:1.5rem_1.25rem]">
        <div className="w-full [max-width:400px] [max-width:420px]">
          {/* Step indicators */}
          <div className="space-y-4">
            <div className={`h-1 w-8 rounded-full transition ${step >= 1 ? 'bg-mesh-600' : 'bg-ink/10'}`} />
            <div className={`h-1 w-8 rounded-full transition ${step >= 2 ? 'bg-mesh-600' : 'bg-ink/10'}`} />
          </div>

          <div className="[margin-bottom:1.75rem]">
            <h1>{step === 1 ? 'Reset your password' : 'Enter new password'}</h1>
            <p>
              {step === 1
                ? 'Enter your university email to receive a reset code.'
                : `Enter the 6-digit code sent to ${email}`}
            </p>
          </div>

          {error && <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</div>}
          {success && <div className="rounded-xl bg-mesh-50 p-3 text-sm font-semibold text-mesh-700" role="status">{success}</div>}

          {step === 1 ? (
            <form onSubmit={handleRequestOtp} noValidate>
              <div className="space-y-4">
                <label className="mb-1.5 block text-xs font-bold text-ink/60" htmlFor="fp-email">University Email</label>
                <div className="space-y-4">
                  <span className="absolute [left:1rem] [font-size:1rem] [color:var(--text-muted)] pointer-events-none"><Mail size={15} strokeWidth={1.75} /></span>
                  <input
                    id="fp-email"
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

              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white transition hover:bg-mesh-700 disabled:opacity-50"
                disabled={isLoading}
                id="fp-send-btn"
              >
                {isLoading ? <><span  /> Sending...</> : 'Send Reset Code'}
              </button>

              <button
                type="button"
                className="mt-3 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white transition hover:bg-mesh-700 disabled:opacity-50"
                onClick={() => navigate('/login')}
              >
                <ArrowLeft size={15} strokeWidth={2} />
                Back to Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} noValidate>
              {/* OTP */}
              <div className="space-y-4">
                <label className="mb-1.5 block text-xs font-bold text-ink/60" htmlFor="fp-otp">6-Digit Reset Code</label>
                <input
                  id="fp-otp"
                  type="text"
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-center text-lg font-semibold tracking-[.4rem] outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  placeholder="Enter 6-digit code"
                  required
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              {/* New Password */}
              <div className="space-y-4">
                <label className="mb-1.5 block text-xs font-bold text-ink/60" htmlFor="fp-newpw">New Password</label>
                <div className="space-y-4">
                  <span className="absolute [left:1rem] [font-size:1rem] [color:var(--text-muted)] pointer-events-none"><Lock size={15} strokeWidth={1.75} /></span>
                  <input
                    id="fp-newpw"
                    type={showPassword ? 'text' : 'password'}
                    className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 pl-11 pr-11 text-sm outline-none focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white transition hover:bg-mesh-700 disabled:opacity-50"
                    onClick={() => setShowPassword(s => !s)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white transition hover:bg-mesh-700 disabled:opacity-50"
                disabled={isLoading || otp.length !== 6 || newPassword.length < 6}
                id="fp-reset-btn"
              >
                {isLoading ? <><span  /> Resetting...</> : 'Reset Password'}
              </button>
            </form>
          )}

          <p >
            Remembered it? <a href="#" onClick={e => { e.preventDefault(); navigate('/login'); }}>Back to Sign In</a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
