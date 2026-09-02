import { useCallback, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, AtSign, Check, Eye, EyeOff, Lock, Mail, ShieldCheck, User, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getApiError, signupUser } from './auth.service';
import type { AuthLoadingState, SignupFieldErrors, SignupFormData } from './auth.types';

type StrengthLevel = 'none' | 'weak' | 'fair' | 'good' | 'strong';

const strengthLevels: StrengthLevel[] = ['weak', 'fair', 'good', 'strong'];

const strengthLabel: Record<StrengthLevel, string> = {
  none: '',
  weak: 'Weak',
  fair: 'Fair',
  good: 'Good',
  strong: 'Strong',
};

const strengthBarClass: Record<StrengthLevel, string> = {
  none: 'bg-ink/10',
  weak: 'bg-red-500',
  fair: 'bg-amber-500',
  good: 'bg-blue-500',
  strong: 'bg-green-500',
};

const strengthTextClass: Record<StrengthLevel, string> = {
  none: 'text-ink/40',
  weak: 'text-red-600',
  fair: 'text-amber-600',
  good: 'text-blue-600',
  strong: 'text-green-600',
};

function getStrength(password: string): StrengthLevel {
  if (!password) return 'none';
  if (password.length < 6) return 'weak';
  if (password.length < 8) return 'fair';
  if (/[A-Z]/.test(password) && /\d/.test(password) && password.length >= 10) return 'strong';
  return 'good';
}

const Signup: React.FC = () => {
  const { api } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<SignupFormData>({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [globalError, setGlobalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loadingState, setLoadingState] = useState<AuthLoadingState>('idle');

  const isLoading = loadingState === 'loading';
  const strength = getStrength(form.password);

  const update = useCallback(
    (field: keyof SignupFormData, value: string) => setForm(current => ({ ...current, [field]: value })),
    [],
  );

  const clearFieldError = (field: keyof SignupFieldErrors) => {
    setFieldErrors(current => ({ ...current, [field]: undefined }));
  };

  function validate(): boolean {
    const errors: SignupFieldErrors = {};

    if (!form.name.trim()) {
      errors.name = 'Full name is required.';
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username.trim())) {
      errors.username = 'Username must be 3–20 characters (letters, numbers, underscores only).';
    }

    if (!form.email.trim().toLowerCase().endsWith('@dbit.co.in')) {
      errors.email = 'Please use your DBIT university email (@dbit.co.in).';
    }

    if (form.password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGlobalError('');

    if (!validate()) return;

    setLoadingState('loading');

    try {
      await signupUser(api, {
        name: form.name,
        username: form.username,
        email: form.email,
        password: form.password,
      });
      navigate('/verify-email', { state: { email: form.email.trim().toLowerCase() } });
    } catch (error: unknown) {
      const message = getApiError(error, 'Failed to create account. Please try again.');
      setLoadingState('error');

      if (error && typeof error === 'object' && 'response' in error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = (error as any).response;
        if (response?.status === 409) {
          const lowerMessage = message.toLowerCase();
          if (lowerMessage.includes('username')) {
            setFieldErrors(current => ({ ...current, username: message }));
            return;
          }
          if (lowerMessage.includes('email')) {
            setFieldErrors(current => ({ ...current, email: message }));
            return;
          }
        }
      }

      setGlobalError(message);
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
            <Users size={14} /> One campus, more possibilities
          </span>
          <h1 className="mt-7 font-display text-6xl font-semibold leading-[.92] tracking-[-.055em] xl:text-7xl">
            Make more of
            <br /> what’s nearby.
          </h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-white/58">
            Join a trusted DBIT community for renting, delivering, and printing the things student life needs.
          </p>

          <ul className="mt-10 space-y-4 text-sm font-semibold text-white/70">
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-mesh-700 text-mesh-200"><ShieldCheck size={15} /></span>
              Verified university members
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-mesh-700 text-mesh-200"><Users size={15} /></span>
              Save money by sharing locally
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-mesh-700 text-mesh-200"><Check size={15} /></span>
              Simple, secure handovers
            </li>
          </ul>
        </div>

        <p className="relative z-10 flex items-center gap-2 text-xs font-semibold text-white/40">
          <ShieldCheck size={15} /> Your campus identity keeps the community private
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
          className="w-full max-w-[470px]"
        >
          <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">New here?</span>
          <h2 className="mt-3 font-display text-5xl font-semibold leading-none">Create your account.</h2>
          <p className="mt-4 text-sm text-ink/48">Use your DBIT email to join the CampusMesh community.</p>

          {globalError && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
              role="alert"
            >
              {globalError}
            </motion.div>
          )}

          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            <label className="block" htmlFor="signup-name">
              <span className="mb-2 block text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">Full name</span>
              <span className="relative block">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/32" size={18} />
                <input
                  id="signup-name"
                  type="text"
                  className="h-13 w-full rounded-2xl border border-mesh-900/15 bg-white px-3 pl-12 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  placeholder="e.g. Amruth Kumar"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={event => { update('name', event.target.value); clearFieldError('name'); }}
                />
              </span>
              {fieldErrors.name && <span className="mt-2 block text-xs font-semibold text-red-600">{fieldErrors.name}</span>}
            </label>

            <label className="block" htmlFor="signup-username">
              <span className="mb-2 block text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">Username</span>
              <span className="relative block">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/32" size={18} />
                <input
                  id="signup-username"
                  type="text"
                  className="h-13 w-full rounded-2xl border border-mesh-900/15 bg-white px-3 pl-12 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  placeholder="e.g. amruth_k"
                  required
                  autoComplete="username"
                  value={form.username}
                  onChange={event => { update('username', event.target.value); clearFieldError('username'); }}
                />
              </span>
              {fieldErrors.username && <span className="mt-2 block text-xs font-semibold text-red-600">{fieldErrors.username}</span>}
            </label>

            <label className="block" htmlFor="signup-email">
              <span className="mb-2 block text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">University email</span>
              <span className="relative block">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/32" size={18} />
                <input
                  id="signup-email"
                  type="email"
                  className="h-13 w-full rounded-2xl border border-mesh-900/15 bg-white px-3 pl-12 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  placeholder="student@dbit.co.in"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={event => { update('email', event.target.value); clearFieldError('email'); }}
                />
              </span>
              {fieldErrors.email && <span className="mt-2 block text-xs font-semibold text-red-600">{fieldErrors.email}</span>}
            </label>

            <div>
              <label className="mb-2 block text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600" htmlFor="signup-password">Password</label>
              <span className="flex h-13 w-full items-center rounded-2xl border border-mesh-900/15 bg-white px-3 transition focus-within:border-mesh-500 focus-within:ring-4 focus-within:ring-mesh-100">
                <Lock className="shrink-0 text-ink/32" size={18} />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                  placeholder="At least 6 characters"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={event => { update('password', event.target.value); clearFieldError('password'); }}
                />
                <button
                  type="button"
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-ink/40 transition hover:bg-mesh-50 hover:text-mesh-700 focus:outline-none focus:ring-4 focus:ring-mesh-100"
                  onClick={() => setShowPassword(current => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
              {form.password && (
                <span className="mt-2 flex items-center gap-1.5" aria-live="polite">
                  <span className="flex flex-1 gap-1">
                    {strengthLevels.map(level => {
                      const active = strengthLevels.indexOf(strength) >= strengthLevels.indexOf(level);
                      return <span key={level} className={`h-1 flex-1 rounded-full transition-colors ${active ? strengthBarClass[strength] : 'bg-ink/10'}`} />;
                    })}
                  </span>
                  <span className={`min-w-11 text-right text-[11px] font-bold ${strengthTextClass[strength]}`}>{strengthLabel[strength]}</span>
                </span>
              )}
              {fieldErrors.password && <span className="mt-2 block text-xs font-semibold text-red-600">{fieldErrors.password}</span>}
            </div>

            <div>
              <label className="mb-2 block text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600" htmlFor="signup-confirm">Confirm password</label>
              <span className="flex h-13 w-full items-center rounded-2xl border border-mesh-900/15 bg-white px-3 transition focus-within:border-mesh-500 focus-within:ring-4 focus-within:ring-mesh-100">
                <Lock className="shrink-0 text-ink/32" size={18} />
                <input
                  id="signup-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                  placeholder="Re-enter your password"
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={event => { update('confirmPassword', event.target.value); clearFieldError('confirmPassword'); }}
                />
                <button
                  type="button"
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-ink/40 transition hover:bg-mesh-50 hover:text-mesh-700 focus:outline-none focus:ring-4 focus:ring-mesh-100"
                  onClick={() => setShowConfirm(current => !current)}
                  aria-label={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
                  aria-pressed={showConfirm}
                >
                  {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
              {fieldErrors.confirmPassword && <span className="mt-2 block text-xs font-semibold text-red-600">{fieldErrors.confirmPassword}</span>}
            </div>

            <button
              type="submit"
              id="signup-submit"
              className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? (
                <><span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" /> Creating account…</>
              ) : (
                <>Create account <ArrowRight size={17} /></>
              )}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-ink/45">
            Already have an account? <Link to="/login" className="font-extrabold text-mesh-700 hover:text-mesh-900">Sign in</Link>
          </p>
        </motion.div>
      </section>
    </main>
  );
};

export default Signup;
