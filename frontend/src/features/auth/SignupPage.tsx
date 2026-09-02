import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, AtSign, ShieldCheck, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signupUser, getApiError } from './auth.service';
import type { SignupFormData, SignupFieldErrors, AuthLoadingState } from './auth.types';

// ─── Password strength ────────────────────────────

type StrengthLevel = 'none' | 'weak' | 'fair' | 'good' | 'strong';

function getStrength(pw: string): StrengthLevel {
  if (!pw) return 'none';
  if (pw.length < 6) return 'weak';
  if (pw.length < 8) return 'fair';
  if (/[A-Z]/.test(pw) && /\d/.test(pw) && pw.length >= 10) return 'strong';
  return 'good';
}

const strengthLabel: Record<StrengthLevel, string> = {
  none:   '',
  weak:   'Weak',
  fair:   'Fair',
  good:   'Good',
  strong: 'Strong',
};

const strengthBarClass: Record<StrengthLevel, string> = {
  none:   'bg-ink/10',
  weak:   'bg-red-500',
  fair:   'bg-amber-500',
  good:   'bg-blue-500',
  strong: 'bg-green-500',
};

const strengthTextClass: Record<StrengthLevel, string> = {
  none:   'text-ink/40',
  weak:   'text-red-600',
  fair:   'text-amber-600',
  good:   'text-blue-600',
  strong: 'text-green-600',
};

// ─── Component ────────────────────────────────────

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
    (field: keyof SignupFormData, value: string) =>
      setForm(prev => ({ ...prev, [field]: value })),
    []
  );

  const clearFieldError = (field: keyof SignupFieldErrors) =>
    setFieldErrors(prev => ({ ...prev, [field]: undefined }));

  // ── Validate ──
  function validate(): boolean {
    const errs: SignupFieldErrors = {};

    if (!form.name.trim()) {
      errs.name = 'Full name is required.';
    }

    const uRx = /^[a-zA-Z0-9_]{3,20}$/;
    if (!uRx.test(form.username.trim())) {
      errs.username = 'Username must be 3–20 characters (letters, numbers, underscores only).';
    }

    if (!form.email.trim().toLowerCase().endsWith('@dbit.co.in')) {
      errs.email = 'Please use your DBIT university email (@dbit.co.in).';
    }

    if (form.password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }

    if (form.password !== form.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
    } catch (err: unknown) {
      const msg = getApiError(err, 'Failed to create account. Please try again.');
      setLoadingState('error');

      // Map 409 conflicts to field errors
      if (err && typeof err === 'object' && 'response' in err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resp = (err as any).response;
        if (resp?.status === 409) {
          const lower = msg.toLowerCase();
          if (lower.includes('username')) {
            setFieldErrors(prev => ({ ...prev, username: msg }));
            return;
          }
          if (lower.includes('email')) {
            setFieldErrors(prev => ({ ...prev, email: msg }));
            return;
          }
        }
      }
      setGlobalError(msg);
    }
  };

  return (
    <div className="[grid-template-columns:1fr]">
      {/* ── Left: Brand Panel ── */}
      <aside className="hidden">
        <div className="[font-size:1.375rem] font-extrabold [color:var(--color-text)] [letter-spacing:-0.04em] [margin-bottom:2.5rem] relative">
          Campus<span>Mesh</span>
        </div>

        <h2 className="[font-size:2rem] font-extrabold [line-height:1.2] [color:var(--color-text)] [letter-spacing:-0.03em] [margin-bottom:1rem] relative">
          Join your campus<br />
          <span>sharing community.</span>
        </h2>

        <p className="[font-size:15px] [color:var(--color-text-secondary)] [line-height:1.65] [max-width:320px] [margin-bottom:2.5rem] relative">
          Connect with verified DBIT students to rent and
          share items — saving money and building community.
        </p>

        <ul className="space-y-3 text-sm text-ink/55">
          <li>
            <span className="[width:28px] [height:28px] [background:var(--color-primary-light)] [border-radius:var(--radius-sm)] flex items-center justify-center shrink-0 [color:var(--color-primary-dark)]"><ShieldCheck size={14} strokeWidth={2} /></span>
            Free to join — no subscription fees
          </li>
          <li>
            <span className="[width:28px] [height:28px] [background:var(--color-primary-light)] [border-radius:var(--radius-sm)] flex items-center justify-center shrink-0 [color:var(--color-primary-dark)]"><Users size={14} strokeWidth={2} /></span>
            Earn from items you already own
          </li>
          <li>
            <span className="[width:28px] [height:28px] [background:var(--color-primary-light)] [border-radius:var(--radius-sm)] flex items-center justify-center shrink-0 [color:var(--color-primary-dark)]"><ShieldCheck size={14} strokeWidth={2} /></span>
            Refundable security deposits protect everyone
          </li>
        </ul>
      </aside>

      {/* ── Right: Form Panel ── */}
      <main className="[padding:2rem_1.5rem] [padding:1.5rem_1.25rem]">
        <div className="w-full [max-width:400px] [max-width:420px]">
          <div className="[margin-bottom:1.75rem]">
            <h1>Create your account</h1>
            <p>Join thousands of DBIT students on CampusMesh</p>
          </div>

          {globalError && (
            <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{globalError}</div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Full Name */}
            <div className="space-y-4">
              <label className="mb-1.5 block text-xs font-bold text-ink/60" htmlFor="signup-name">Full Name</label>
              <div className="space-y-4">
                <span className="absolute [left:1rem] [font-size:1rem] [color:var(--text-muted)] pointer-events-none"><User size={15} strokeWidth={1.75} /></span>
                <input
                  id="signup-name"
                  type="text"
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 pl-11 text-sm outline-none focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  placeholder="e.g. Amruth Kumar"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={e => { update('name', e.target.value); clearFieldError('name'); }}
                />
              </div>
              {fieldErrors.name && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.name}</p>}
            </div>

            {/* Username */}
            <div className="space-y-4">
              <label className="mb-1.5 block text-xs font-bold text-ink/60" htmlFor="signup-username">Username</label>
              <div className="space-y-4">
                <span className="absolute [left:1rem] [font-size:1rem] [color:var(--text-muted)] pointer-events-none"><AtSign size={15} strokeWidth={1.75} /></span>
                <input
                  id="signup-username"
                  type="text"
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 pl-11 text-sm outline-none focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  placeholder="e.g. amruth_k"
                  required
                  autoComplete="username"
                  value={form.username}
                  onChange={e => { update('username', e.target.value); clearFieldError('username'); }}
                />
              </div>
              {fieldErrors.username && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.username}</p>}
            </div>

            {/* University Email */}
            <div className="space-y-4">
              <label className="mb-1.5 block text-xs font-bold text-ink/60" htmlFor="signup-email">University Email</label>
              <div className="space-y-4">
                <span className="absolute [left:1rem] [font-size:1rem] [color:var(--text-muted)] pointer-events-none"><Mail size={15} strokeWidth={1.75} /></span>
                <input
                  id="signup-email"
                  type="email"
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 pl-11 text-sm outline-none focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  placeholder="Must end in @dbit.co.in"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={e => { update('email', e.target.value); clearFieldError('email'); }}
                />
              </div>
              {fieldErrors.email && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-4">
              <label className="mb-1.5 block text-xs font-bold text-ink/60" htmlFor="signup-password">Password</label>
              <div className="space-y-4">
                <span className="absolute [left:1rem] [font-size:1rem] [color:var(--text-muted)] pointer-events-none"><Lock size={15} strokeWidth={1.75} /></span>
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 pl-11 pr-11 text-sm outline-none focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  placeholder="Min. 6 characters"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={e => { update('password', e.target.value); clearFieldError('password'); }}
                />
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white transition hover:bg-mesh-700 disabled:opacity-50"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                </button>
              </div>
              {/* Strength bar */}
              {form.password && (
                <div className="mt-1.5 flex items-center gap-1">
                  {(['weak', 'fair', 'good', 'strong'] as StrengthLevel[]).map(level => {
                    const levels: StrengthLevel[] = ['weak', 'fair', 'good', 'strong'];
                    const active = levels.indexOf(strength as StrengthLevel) >= levels.indexOf(level);
                    return (
                      <div key={level} className={`h-[3px] flex-1 rounded-full transition-colors ${active ? strengthBarClass[strength] : 'bg-ink/10'}`} />
                    );
                  })}
                  <span className={`min-w-10 text-right text-[11px] font-semibold ${strengthTextClass[strength]}`}>
                    {strengthLabel[strength]}
                  </span>
                </div>
              )}
              {fieldErrors.password && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-4">
              <label className="mb-1.5 block text-xs font-bold text-ink/60" htmlFor="signup-confirm">Confirm Password</label>
              <div className="space-y-4">
                <span className="absolute [left:1rem] [font-size:1rem] [color:var(--text-muted)] pointer-events-none"><Lock size={15} strokeWidth={1.75} /></span>
                <input
                  id="signup-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 pl-11 pr-11 text-sm outline-none focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  placeholder="Re-enter your password"
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={e => { update('confirmPassword', e.target.value); clearFieldError('confirmPassword'); }}
                />
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white transition hover:bg-mesh-700 disabled:opacity-50"
                  onClick={() => setShowConfirm(s => !s)}
                  aria-label={showConfirm ? 'Hide' : 'Show'}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                </button>
              </div>
              {fieldErrors.confirmPassword && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.confirmPassword}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="signup-submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white transition hover:bg-mesh-700 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? (
                <><span  /> Creating account...</>
              ) : (
                <>Create Account <ArrowRight size={15} strokeWidth={2} /></>
              )}
            </button>
          </form>

          <p >
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Signup;
