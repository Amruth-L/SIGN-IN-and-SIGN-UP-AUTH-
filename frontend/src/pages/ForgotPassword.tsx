import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { requestPasswordReset, resetPassword, getApiError } from '../auth/authService';
import type { AuthLoadingState } from '../auth/authTypes';
import './Auth.css';

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
    <div className="auth-layout">
      {/* ── Left: Brand panel ── */}
      <aside className="auth-brand">
        <div className="auth-brand-logo">Campus<span>Mesh</span></div>

        <h2 className="auth-brand-headline">
          Forgot your<br />
          <span>password?</span>
        </h2>

        <p className="auth-brand-sub">
          No problem. Enter your DBIT university email and we'll
          send you a one-time reset code.
        </p>

        <ul className="auth-features">
          <li>
            <span className="auth-feature-icon"><Mail size={14} strokeWidth={2} /></span>
            Code sent to your university email
          </li>
          <li>
            <span className="auth-feature-icon"><Lock size={14} strokeWidth={2} /></span>
            Code expires in 10 minutes
          </li>
        </ul>
      </aside>

      {/* ── Right: Form panel ── */}
      <main className="auth-form-panel">
        <div className="auth-form-inner">
          {/* Step indicators */}
          <div className="auth-steps">
            <div className={`auth-step-dot ${step >= 1 ? 'active' : ''}`} />
            <div className={`auth-step-dot ${step >= 2 ? 'active' : ''}`} />
          </div>

          <div className="auth-form-header">
            <h1>{step === 1 ? 'Reset your password' : 'Enter new password'}</h1>
            <p>
              {step === 1
                ? 'Enter your university email to receive a reset code.'
                : `Enter the 6-digit code sent to ${email}`}
            </p>
          </div>

          {error && <div className="error-message" role="alert">{error}</div>}
          {success && <div className="success-message" role="status">{success}</div>}

          {step === 1 ? (
            <form onSubmit={handleRequestOtp} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="fp-email">University Email</label>
                <div className="input-wrapper">
                  <span className="input-icon-left"><Mail size={15} strokeWidth={1.75} /></span>
                  <input
                    id="fp-email"
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

              <button
                type="submit"
                className="btn btn-primary btn-block auth-submit-btn"
                disabled={isLoading}
                id="fp-send-btn"
              >
                {isLoading ? <><span className="spinner" /> Sending...</> : 'Send Reset Code'}
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-block"
                style={{ marginTop: '0.75rem', gap: '0.375rem' }}
                onClick={() => navigate('/login')}
              >
                <ArrowLeft size={15} strokeWidth={2} />
                Back to Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} noValidate>
              {/* OTP */}
              <div className="form-group">
                <label className="form-label" htmlFor="fp-otp">6-Digit Reset Code</label>
                <input
                  id="fp-otp"
                  type="text"
                  className="form-input"
                  placeholder="Enter 6-digit code"
                  required
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  style={{ letterSpacing: '0.4rem', textAlign: 'center', fontSize: '1.125rem', fontWeight: 600 }}
                />
              </div>

              {/* New Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="fp-newpw">New Password</label>
                <div className="input-wrapper">
                  <span className="input-icon-left"><Lock size={15} strokeWidth={1.75} /></span>
                  <input
                    id="fp-newpw"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input has-icon-left has-icon-right"
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="input-icon-right"
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
                className="btn btn-primary btn-block auth-submit-btn"
                disabled={isLoading || otp.length !== 6 || newPassword.length < 6}
                id="fp-reset-btn"
              >
                {isLoading ? <><span className="spinner" /> Resetting...</> : 'Reset Password'}
              </button>
            </form>
          )}

          <p className="auth-footer-link">
            Remembered it? <a href="#" onClick={e => { e.preventDefault(); navigate('/login'); }}>Back to Sign In</a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
