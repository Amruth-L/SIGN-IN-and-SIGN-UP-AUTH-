import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Eye, EyeOff, Lock, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getApiError, loginUser } from './auth.service';
import type { AuthLoadingState, LoginFormData } from './auth.types';

export default function LoginPage() {
  const { api, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<LoginFormData>({ email: '', password: '', remember: false });
  const [showPassword, setShowPassword] = useState(false);
  const [loadingState, setLoadingState] = useState<AuthLoadingState>('idle');
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('cm_remember');
    if (rememberedEmail) setForm(current => ({ ...current, email: rememberedEmail, remember: true }));
  }, []);

  const update = useCallback(
    (field: keyof LoginFormData, value: string | boolean) =>
      setForm(current => ({ ...current, [field]: value })),
    [],
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNeedsVerification(false);
    setLoadingState('loading');
    try {
      const data = await loginUser(api, { email: form.email, password: form.password });
      await login(data.token);
      if (form.remember) localStorage.setItem('cm_remember', form.email.trim().toLowerCase());
      else localStorage.removeItem('cm_remember');
      setLoadingState('success');
      navigate('/choose-mode');
    } catch (caught: unknown) {
      setError(getApiError(caught, 'Invalid email or password.'));
      setLoadingState('error');
      if (caught && typeof caught === 'object' && 'response' in caught) {
        const response = (caught as { response?: { status?: number } }).response;
        setNeedsVerification(response?.status === 403);
      }
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
            <MapPin size={14} /> Built for one campus
          </span>
          <h1 className="mt-7 font-display text-6xl font-semibold leading-[.92] tracking-[-.055em] xl:text-7xl">
            Useful things,
            <br /> already nearby.
          </h1>
          <p className="mt-6 text-base text-white/58">Rent. Deliver. Print.</p>
        </div>
        <p className="relative z-10 flex items-center gap-2 text-xs font-semibold text-white/40">
          <ShieldCheck size={15} /> Campus identity · private documents · secure handovers
        </p>
      </motion.section>

      <section className="relative flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
        <Link to="/" className="absolute left-5 top-6 text-lg font-extrabold tracking-[-.05em] lg:hidden">
          Campus<span className="text-mesh-600">Mesh</span>
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .45, delay: .08 }}
          className="w-full max-w-[430px]"
        >
          <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">Welcome back</span>
          <h2 className="mt-3 font-display text-5xl font-semibold leading-none">Sign in.</h2>
          <p className="mt-4 text-sm text-ink/48">Use your university email.</p>

          {error && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
              {needsVerification && (
                <button type="button" onClick={() => navigate('/verify-email', { state: { email: form.email } })} className="mt-2 flex items-center gap-1 font-extrabold">
                  Verify email now <ArrowRight size={14} />
                </button>
              )}
            </motion.div>
          )}

          <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
            <label className="block">
              <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600 mb-2 block">University email</span>
              <span className="relative block">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/32" size={18} />
                <input id="login-email" type="email" className="h-11 w-full rounded-xl border border-mesh-900/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100 h-13 rounded-2xl pl-12" placeholder="student@dbit.co.in" autoComplete="email" required value={form.email} onChange={event => update('email', event.target.value)} />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 flex items-center justify-between">
                <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">Password</span>
                <Link to="/forgot-password" className="text-xs font-bold text-mesh-700 hover:text-mesh-900">Forgot password?</Link>
              </span>
              <span className="relative block">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/32" size={18} />
                <input id="login-password" type={showPassword ? 'text' : 'password'} className="h-11 w-full rounded-xl border border-mesh-900/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100 h-13 rounded-2xl px-12" placeholder="Enter your password" autoComplete="current-password" required value={form.password} onChange={event => update('password', event.target.value)} />
                <button type="button" onClick={() => setShowPassword(current => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink/38 hover:bg-mesh-50" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            <label className="flex w-fit items-center gap-2 text-xs font-semibold text-ink/52">
              <input type="checkbox" className="size-4 accent-emerald-700" checked={form.remember} onChange={event => update('remember', event.target.checked)} /> Remember this email
            </label>
            <button id="login-submit" type="submit" disabled={loadingState === 'loading'} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 h-13 w-full rounded-2xl">
              {loadingState === 'loading' ? 'Signing in…' : <>Sign in <ArrowRight size={17} /></>}
            </button>
          </form>
          <p className="mt-7 text-center text-sm text-ink/45">
            New to CampusMesh? <Link to="/signup" className="font-extrabold text-mesh-700">Create an account</Link>
          </p>
        </motion.div>
      </section>
    </main>
  );
}
