import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Mail, RotateCcw, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getApiError, resendOtp, verifyEmail } from './auth.service';
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
  const [loadingAction, setLoadingAction] = useState<'verify' | 'resend' | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const isLoading = loadingState === 'loading';
  const displayEmail = email.trim() || 'your university email';

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setResendCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoadingState('loading');
    setLoadingAction('verify');

    try {
      await verifyEmail(api, { email: email.trim().toLowerCase(), otp });
      setSuccess('Email verified! Redirecting you to sign in…');
      setLoadingState('success');
      setLoadingAction(null);
      window.setTimeout(() => navigate('/login'), 1800);
    } catch (caught: unknown) {
      setError(getApiError(caught, 'Verification failed. Please check your code and try again.'));
      setLoadingState('error');
      setLoadingAction(null);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setError('Enter your university email first.');
      return;
    }

    setError('');
    setSuccess('');
    setLoadingState('loading');
    setLoadingAction('resend');

    try {
      await resendOtp(api, { email: email.trim().toLowerCase() });
      setSuccess('A new verification code is on its way.');
      setResendCooldown(60);
      setLoadingState('idle');
      setLoadingAction(null);
    } catch (caught: unknown) {
      setError(getApiError(caught, 'Could not resend the code. Please try again.'));
      setLoadingState('error');
      setLoadingAction(null);
    }
  };

  return (
    <main className="grid min-h-screen bg-paper lg:grid-cols-[1.08fr_.92fr]">
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative hidden overflow-hidden bg-mesh-900 px-10 py-9 text-white lg:flex lg:flex-col xl:px-16"
      >
        <div className="pointer-events-none absolute -right-28 -top-28 size-96 rounded-full border-[72px] border-mesh-700/45" />
        <div className="pointer-events-none absolute -bottom-40 -left-36 size-[32rem] rounded-full bg-mesh-700/35 blur-2xl" />

        <Link to="/" className="relative z-10 w-fit text-xl font-extrabold tracking-[-.05em]">
          Campus<span className="text-mesh-300">Mesh</span>
        </Link>

        <div className="relative z-10 my-auto max-w-xl py-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-bold text-mesh-200">
            <ShieldCheck size={14} /> Almost there
          </span>
          <h1 className="mt-7 font-display text-6xl font-semibold leading-[.92] tracking-[-.055em] xl:text-7xl">
            Your campus,
            <br /> verified.
          </h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-white/58">
            Confirm your DBIT email to keep CampusMesh useful, private, and local to your campus community.
          </p>

          <ul className="mt-10 space-y-4 text-sm font-semibold text-white/70">
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-mesh-700 text-mesh-200"><Mail size={15} /></span>
              Check your inbox and spam folder
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-mesh-700 text-mesh-200"><RotateCcw size={15} /></span>
              Your code expires in 10 minutes
            </li>
          </ul>
        </div>

        <p className="relative z-10 flex items-center gap-2 text-xs font-semibold text-white/40">
          <Check size={15} /> One quick step before you get started
        </p>
      </motion.section>

      <section className="relative flex min-h-screen items-center justify-center overflow-y-auto px-5 py-16 sm:px-10 lg:py-12">
        <Link to="/" className="absolute left-5 top-6 text-lg font-extrabold tracking-[-.05em] lg:hidden">
          Campus<span className="text-mesh-600">Mesh</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="w-full max-w-[430px]"
        >
          <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">Email verification</span>
          <h2 className="mt-3 font-display text-5xl font-semibold leading-none">Check your inbox.</h2>
          <p className="mt-4 text-sm leading-6 text-ink/48">
            Enter the 6-digit code sent to <strong className="break-all text-ink/75">{displayEmail}</strong>.
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
              role="alert"
            >
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border border-mesh-200 bg-mesh-50 p-4 text-sm font-semibold text-mesh-700"
              role="status"
            >
              {success}
            </motion.div>
          )}

          <form className="mt-8 space-y-5" onSubmit={handleVerify} noValidate>
            {!initialEmail && (
              <label className="block" htmlFor="ve-email">
                <span className="mb-2 block text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">University email</span>
                <span className="relative block">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/32" size={18} />
                  <input
                    id="ve-email"
                    type="email"
                    className="h-13 w-full rounded-2xl border border-mesh-900/15 bg-white px-3 pl-12 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                    placeholder="student@dbit.co.in"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                  />
                </span>
              </label>
            )}

            <label className="block" htmlFor="ve-otp">
              <span className="mb-2 block text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">Verification code</span>
              <input
                id="ve-otp"
                type="text"
                className="h-13 w-full rounded-2xl border border-mesh-900/15 bg-white px-4 text-center text-xl font-extrabold tracking-[.45em] outline-none transition placeholder:font-semibold placeholder:tracking-[.18em] placeholder:text-ink/30 focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                placeholder="6-digit code"
                required
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                autoFocus={Boolean(initialEmail)}
                value={otp}
                onChange={event => setOtp(event.target.value.replace(/\D/g, ''))}
              />
            </label>

            <button
              type="submit"
              id="ve-submit"
              className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-mesh-600 px-5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
              disabled={isLoading || loadingState === 'success' || otp.length !== 6}
            >
              {loadingAction === 'verify' ? 'Verifying…' : <>Verify email <ArrowRight size={17} /></>}
            </button>
          </form>

          <div className="mt-8 border-t border-ink/10 pt-6 text-center">
            <p className="text-sm text-ink/45">Didn’t receive the code?</p>
            <button
              type="button"
              id="ve-resend"
              className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-5 text-sm font-extrabold text-mesh-700 transition hover:border-mesh-500 hover:bg-mesh-50 disabled:pointer-events-none disabled:opacity-50"
              onClick={handleResend}
              disabled={isLoading || resendCooldown > 0}
            >
              <RotateCcw size={15} />
              {loadingAction === 'resend' ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>

          <Link to="/login" className="mt-7 flex items-center justify-center gap-1.5 text-sm font-extrabold text-mesh-700 hover:text-mesh-900">
            <ArrowLeft size={15} /> Back to sign in
          </Link>
        </motion.div>
      </section>
    </main>
  );
};

export default VerifyEmail;
