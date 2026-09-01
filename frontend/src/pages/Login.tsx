import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, BookOpen, Calculator, Laptop, ShieldCheck, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loginUser, getApiError } from '../auth/authService';
import type { LoginFormData, AuthLoadingState } from '../auth/authTypes';
import './Auth.css';

// ─── Brand panel preview items ────────────────────

const previewItems = [
  { icon: BookOpen,   name: 'Engineering Mathematics',  price: '₹8/day', badge: 'RENT' },
  { icon: Calculator, name: 'Scientific Calculator',    price: 'Free',   badge: 'BORROW' },
  { icon: Laptop,     name: 'Laptop Stand',             price: '₹15/day', badge: 'RENT' },
];

// ─── Component ────────────────────────────────────

const Login: React.FC = () => {
  const { api, login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<LoginFormData>({
    email: '',
    password: '',
    remember: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loadingState, setLoadingState] = useState<AuthLoadingState>('idle');
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);

  const isLoading = loadingState === 'loading';

  const update = useCallback(
    (field: keyof LoginFormData, value: string | boolean) =>
      setForm(prev => ({ ...prev, [field]: value })),
    []
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);
    setLoadingState('loading');

    try {
      const data = await loginUser(api, { email: form.email, password: form.password });
      await login(data.token);

      if (form.remember) {
        localStorage.setItem('cm_remember', form.email);
      } else {
        localStorage.removeItem('cm_remember');
      }

      setLoadingState('success');
      navigate('/choose-mode');
    } catch (err: unknown) {
      const msg = getApiError(err, 'Invalid email or password.');
      setError(msg);
      setLoadingState('error');

      if (err && typeof err === 'object' && 'response' in err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((err as any).response?.status === 403) {
          setNeedsVerification(true);
        }
      }
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
          Everything your campus needs,<br />
          <span>shared by students.</span>
        </h2>

        <p className="auth-brand-sub">
          Rent, borrow and lend items with verified students
          around you — safely and affordably.
        </p>

        {/* Feature list */}
        <ul className="auth-features">
          <li>
            <span className="auth-feature-icon"><ShieldCheck size={14} strokeWidth={2} /></span>
            Verified DBIT student accounts only
          </li>
          <li>
            <span className="auth-feature-icon"><Users size={14} strokeWidth={2} /></span>
            Trusted peer-to-peer exchanges
          </li>
          <li>
            <span className="auth-feature-icon"><ShieldCheck size={14} strokeWidth={2} /></span>
            Secure QR handover verification
          </li>
        </ul>

        {/* Preview cards */}
        <div className="auth-preview-cards">
          {previewItems.map(({ icon: Icon, name, price, badge }) => (
            <div className="auth-preview-card" key={name}>
              <div className="auth-preview-card-icon">
                <Icon size={16} strokeWidth={1.75} />
              </div>
              <div className="auth-preview-card-info">
                <div className="auth-preview-card-name">{name}</div>
                <div className="auth-preview-card-price">{price}</div>
              </div>
              <span className="auth-preview-card-badge">{badge}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Right: Form Panel ── */}
      <main className="auth-form-panel">
        <div className="auth-form-inner">
          <div className="auth-form-header">
            <h1>Welcome back</h1>
            <p>Sign in to your CampusMesh account</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="error-message" role="alert">
              {error}
              {needsVerification && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  style={{ marginTop: '0.5rem', alignSelf: 'flex-start' }}
                  onClick={() => navigate('/verify-email', { state: { email: form.email } })}
                >
                  Verify email now <ArrowRight size={13} />
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">University Email</label>
              <div className="input-wrapper">
                <span className="input-icon-left"><Mail size={15} strokeWidth={1.75} /></span>
                <input
                  id="login-email"
                  type="email"
                  className="form-input has-icon-left"
                  placeholder="1DB23AD001@dbit.co.in"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <div className="form-label-row">
                <label className="form-label" htmlFor="login-password">Password</label>
                <Link to="/forgot-password" className="auth-forgot-link">Forgot password?</Link>
              </div>
              <div className="input-wrapper">
                <span className="input-icon-left"><Lock size={15} strokeWidth={1.75} /></span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input has-icon-left has-icon-right"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
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
            </div>

            {/* Remember me */}
            <div className="auth-remember-row">
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={e => update('remember', e.target.checked)}
                />
                Remember me
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="login-submit"
              className="btn btn-primary btn-block auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={15} strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          <p className="auth-footer-link">
            Don't have an account?{' '}
            <Link to="/signup">Create account</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Login;
