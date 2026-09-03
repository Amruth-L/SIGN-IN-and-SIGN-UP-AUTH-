import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getApiError, requestPasswordReset, resetPassword } from './auth.service';
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
  const [loadingAction, setLoadingAction] = useState<'request' | 'reset' | null>(null);

  const isLoading = loadingState === 'loading';

  const handleRequestOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoadingState('loading');
    setLoadingAction('request');

    try {
      const response = await requestPasswordReset(api, { email: email.trim().toLowerCase() });
      setSuccess(response.message || 'Reset code sent. Check your inbox.');
      setLoadingState('idle');
      setLoadingAction(null);
      setStep(2);
    } catch (caught: unknown) {
      setError(getApiError(caught, 'Could not send the reset code. Please try again.'));
      setLoadingState('error');
      setLoadingAction(null);
    }
  };

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoadingState('loading');
    setLoadingAction('reset');

    try {
      const response = await resetPassword(api, {
        email: email.trim().toLowerCase(),
        otp,
        newPassword,
      });
      setSuccess(response.message || 'Password reset successfully!');
      setLoadingState('success');
      setLoadingAction(null);
      window.setTimeout(() => navigate('/login'), 1800);
    } catch (caught: unknown) {
      setError(getApiError(caught, 'Could not reset your password. Check the code and try again.'));
      setLoadingState('error');
      setLoadingAction(null);
    }
  };

  const backToEmail = () => {
    setStep(1);
    setOtp('');
    setNewPassword('');
    setError('');
    setSuccess('');
    setLoadingState('idle');
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
            <ShieldCheck size={14} /> Account recovery
          </span>
          <h1 className="mt-7 font-display text-6xl font-semibold leading-[.92] tracking-[-.055em] xl:text-7xl">
            A fresh start,
            <br /> securely.
          </h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-white/58">
            We’ll help you get back into your CampusMesh account with a one-time code sent to your DBIT email.
          </p>

          <ul className="mt-10 space-y-4 text-sm font-semibold text-white/70">
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-mesh-700 text-mesh-200"><Mail size={15} /></span>
              Use your university email
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-mesh-700 text-mesh-200"><KeyRound size={15} /></span>
              One-time code expires in 10 minutes
            </li>
          </ul>
        </div>

        <p className="relative z-10 flex items-center gap-2 text-xs font-semibold text-white/40">
          <Check size={15} /> Your account stays yours
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
          <div className="mb-8 flex items-center gap-2" aria-label={`Step ${step} of 2`}>
            <span className={`h-1.5 w-12 rounded-full transition ${step >= 1 ? 'bg-mesh-600' : 'bg-ink/10'}`} />
            <span className={`h-1.5 w-12 rounded-full transition ${step >= 2 ? 'bg-mesh-600' : 'bg-ink/10'}`} />
          </div>

          <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">
            {step === 1 ? 'Account recovery' : 'New password'}
          </span>
          <h2 className="mt-3 font-display text-5xl font-semibold leading-none">
            {step === 1 ? 'Reset your password.' : 'Create a new password.'}
          </h2>
          <p className="mt-4 text-sm leading-6 text-ink/48">
            {step === 1 ? (
              'Enter your university email to receive a reset code.'
            ) : (
              <>Enter the 6-digit code sent to <strong className="break-all text-ink/75">{email}</strong>.</>
            )}
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

          {step === 1 ? (
            <form className="mt-8 space-y-5" onSubmit={handleRequestOtp} noValidate>
              <label className="block" htmlFor="fp-email">
                <span className="mb-2 block text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">University email</span>
                <span className="relative block">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/32" size={18} />
                  <input
                    id="fp-email"
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

              <button
                type="submit"
                id="fp-send-btn"
                className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-mesh-600 px-5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
                disabled={isLoading}
              >
                {loadingAction === 'request' ? 'Sending…' : <>Send reset code <ArrowRight size={17} /></>}
              </button>

              <button
                type="button"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-5 text-sm font-extrabold text-mesh-700 transition hover:border-mesh-500 hover:bg-mesh-50"
                onClick={() => navigate('/login')}
              >
                <ArrowLeft size={15} /> Back to sign in
              </button>
            </form>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleResetPassword} noValidate>
              <label className="block" htmlFor="fp-otp">
                <span className="mb-2 block text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">6-digit reset code</span>
                <input
                  id="fp-otp"
                  type="text"
                  className="h-13 w-full rounded-2xl border border-mesh-900/15 bg-white px-4 text-center text-xl font-extrabold tracking-[.45em] outline-none transition placeholder:font-semibold placeholder:tracking-[.18em] placeholder:text-ink/30 focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  placeholder="6-digit code"
                  required
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  autoFocus
                  value={otp}
                  onChange={event => setOtp(event.target.value.replace(/\D/g, ''))}
                />
              </label>

              <label className="block" htmlFor="fp-newpw">
                <span className="mb-2 block text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">New password</span>
                <span className="relative block">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/32" size={18} />
                  <input
                    id="fp-newpw"
                    type={showPassword ? 'text' : 'password'}
                    className="h-13 w-full rounded-2xl border border-mesh-900/15 bg-white px-3 pl-12 pr-12 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={event => setNewPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-ink/40 transition hover:bg-mesh-50 hover:text-mesh-700"
                    onClick={() => setShowPassword(value => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>

              <button
                type="submit"
                id="fp-reset-btn"
                className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-mesh-600 px-5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
                disabled={isLoading || loadingState === 'success' || otp.length !== 6 || newPassword.length < 6}
              >
                {loadingAction === 'reset' ? 'Resetting…' : <>Reset password <ArrowRight size={17} /></>}
              </button>

              <button
                type="button"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-5 text-sm font-extrabold text-mesh-700 transition hover:border-mesh-500 hover:bg-mesh-50"
                onClick={backToEmail}
                disabled={isLoading}
              >
                <ArrowLeft size={15} /> Use a different email
              </button>
            </form>
          )}

          <p className="mt-7 text-center text-sm text-ink/45">
            Remembered your password? <Link to="/login" className="font-extrabold text-mesh-700">Back to sign in</Link>
          </p>
        </motion.div>
      </section>
    </main>
  );
};

export default ForgotPassword;
