import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { verifyEmail, resendOtp, getApiError } from '../auth/authService';
import type { AuthLoadingState } from '../auth/authTypes';
import './Auth.css';

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
    <div className="auth-layout">
      {/* ── Left: Brand panel ── */}
      <aside className="auth-brand">
        <div className="auth-brand-logo">Campus<span>Mesh</span></div>

        <h2 className="auth-brand-headline">
          One step<br />
          <span>left to go.</span>
        </h2>

        <p className="auth-brand-sub">
          We sent a 6-digit verification code to your DBIT university email.
          Enter it to activate your account.
        </p>

        <ul className="auth-features">
          <li>
            <span className="auth-feature-icon"><Mail size={14} strokeWidth={2} /></span>
            Check your inbox and spam folder
          </li>
          <li>
            <span className="auth-feature-icon"><RotateCcw size={14} strokeWidth={2} /></span>
            Code expires in 10 minutes
          </li>
        </ul>
      </aside>

      {/* ── Right: Form panel ── */}
      <main className="auth-form-panel">
        <div className="auth-form-inner">
          <div className="auth-form-header">
            <h1>Check your inbox</h1>
            <p>
              Enter the 6-digit code sent to{' '}
              {initialEmail ? <strong>{initialEmail}</strong> : 'your university email'}
            </p>
          </div>

          {error && <div className="error-message" role="alert">{error}</div>}
          {success && <div className="success-message" role="status">{success}</div>}

          <form onSubmit={handleVerify} noValidate>
            {/* Email field — only shown if not passed via router state */}
            {!initialEmail && (
              <div className="form-group">
                <label className="form-label" htmlFor="ve-email">University Email</label>
                <div className="input-wrapper">
                  <span className="input-icon-left"><Mail size={15} strokeWidth={1.75} /></span>
                  <input
                    id="ve-email"
                    type="email"
                    className="form-input has-icon-left"
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
            <div className="form-group">
              <label className="form-label" htmlFor="ve-otp">Verification Code</label>
              <input
                id="ve-otp"
                type="text"
                className="form-input"
                placeholder="Enter 6-digit code"
                required
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                style={{
                  letterSpacing: '0.4rem',
                  textAlign: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                }}
              />
            </div>

            <button
              type="submit"
              id="ve-submit"
              className="btn btn-primary btn-block auth-submit-btn"
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading
                ? <><span className="spinner" /> Verifying...</>
                : 'Verify Email'}
            </button>
          </form>

          {/* Resend section */}
          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <p className="auth-footer-link" style={{ marginTop: 0 }}>
              Didn't receive the code?
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ marginTop: '0.625rem', gap: '0.375rem' }}
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
