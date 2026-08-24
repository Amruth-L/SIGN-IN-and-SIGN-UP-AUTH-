import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, AtSign, ShieldCheck, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { signupUser, getApiError } from '../auth/authService';
import type { SignupFormData, SignupFieldErrors, AuthLoadingState } from '../auth/authTypes';
import './Auth.css';

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

const strengthColor: Record<StrengthLevel, string> = {
  none:   'var(--color-border)',
  weak:   '#EF4444',
  fair:   '#F59E0B',
  good:   '#3B82F6',
  strong: '#22C55E',
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
    <div className="auth-layout">
      {/* ── Left: Brand Panel ── */}
      <aside className="auth-brand">
        <div className="auth-brand-logo">
          Campus<span>Mesh</span>
        </div>

        <h2 className="auth-brand-headline">
          Join your campus<br />
          <span>sharing community.</span>
        </h2>

        <p className="auth-brand-sub">
          Connect with verified DBIT students to rent, borrow and
          share items — saving money and building community.
        </p>

        <ul className="auth-features">
          <li>
            <span className="auth-feature-icon"><ShieldCheck size={14} strokeWidth={2} /></span>
            Free to join — no subscription fees
          </li>
          <li>
            <span className="auth-feature-icon"><Users size={14} strokeWidth={2} /></span>
            Earn from items you already own
          </li>
          <li>
            <span className="auth-feature-icon"><ShieldCheck size={14} strokeWidth={2} /></span>
            Refundable security deposits protect everyone
          </li>
        </ul>
      </aside>

      {/* ── Right: Form Panel ── */}
      <main className="auth-form-panel">
        <div className="auth-form-inner">
          <div className="auth-form-header">
            <h1>Create your account</h1>
            <p>Join thousands of DBIT students on CampusMesh</p>
          </div>

          {globalError && (
            <div className="error-message" role="alert">{globalError}</div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Full Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="signup-name">Full Name</label>
              <div className="input-wrapper">
                <span className="input-icon-left"><User size={15} strokeWidth={1.75} /></span>
                <input
                  id="signup-name"
                  type="text"
                  className="form-input has-icon-left"
                  placeholder="e.g. Amruth Kumar"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={e => { update('name', e.target.value); clearFieldError('name'); }}
                />
              </div>
              {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
            </div>

            {/* Username */}
            <div className="form-group">
              <label className="form-label" htmlFor="signup-username">Username</label>
              <div className="input-wrapper">
                <span className="input-icon-left"><AtSign size={15} strokeWidth={1.75} /></span>
                <input
                  id="signup-username"
                  type="text"
                  className="form-input has-icon-left"
                  placeholder="e.g. amruth_k"
                  required
                  autoComplete="username"
                  value={form.username}
                  onChange={e => { update('username', e.target.value); clearFieldError('username'); }}
                />
              </div>
              {fieldErrors.username && <p className="field-error">{fieldErrors.username}</p>}
            </div>

            {/* University Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="signup-email">University Email</label>
              <div className="input-wrapper">
                <span className="input-icon-left"><Mail size={15} strokeWidth={1.75} /></span>
                <input
                  id="signup-email"
                  type="email"
                  className="form-input has-icon-left"
                  placeholder="Must end in @dbit.co.in"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={e => { update('email', e.target.value); clearFieldError('email'); }}
                />
              </div>
              {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="signup-password">Password</label>
              <div className="input-wrapper">
                <span className="input-icon-left"><Lock size={15} strokeWidth={1.75} /></span>
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input has-icon-left has-icon-right"
                  placeholder="Min. 6 characters"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={e => { update('password', e.target.value); clearFieldError('password'); }}
                />
                <button
                  type="button"
                  className="input-icon-right"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                </button>
              </div>
              {/* Strength bar */}
              {form.password && (
                <div style={{ marginTop: '6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {(['weak', 'fair', 'good', 'strong'] as StrengthLevel[]).map(level => {
                    const levels: StrengthLevel[] = ['weak', 'fair', 'good', 'strong'];
                    const active = levels.indexOf(strength as StrengthLevel) >= levels.indexOf(level);
                    return (
                      <div
                        key={level}
                        style={{
                          flex: 1,
                          height: '3px',
                          borderRadius: '99px',
                          background: active ? strengthColor[strength] : 'var(--color-border)',
                          transition: 'background 0.25s',
                        }}
                      />
                    );
                  })}
                  <span style={{ fontSize: '11px', color: strengthColor[strength], fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>
                    {strengthLabel[strength]}
                  </span>
                </div>
              )}
              {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="signup-confirm">Confirm Password</label>
              <div className="input-wrapper">
                <span className="input-icon-left"><Lock size={15} strokeWidth={1.75} /></span>
                <input
                  id="signup-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  className="form-input has-icon-left has-icon-right"
                  placeholder="Re-enter your password"
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={e => { update('confirmPassword', e.target.value); clearFieldError('confirmPassword'); }}
                />
                <button
                  type="button"
                  className="input-icon-right"
                  onClick={() => setShowConfirm(s => !s)}
                  aria-label={showConfirm ? 'Hide' : 'Show'}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                </button>
              </div>
              {fieldErrors.confirmPassword && <p className="field-error">{fieldErrors.confirmPassword}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="signup-submit"
              className="btn btn-primary btn-block auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <><span className="spinner" /> Creating account...</>
              ) : (
                <>Create Account <ArrowRight size={15} strokeWidth={2} /></>
              )}
            </button>
          </form>

          <p className="auth-footer-link">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Signup;
