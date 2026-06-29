import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import './Auth.css';

const VerifyEmail = () => {
  const { api } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get email from router state if they came from Signup/Login
  const initialEmail = location.state?.email || '';
  
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // If user arrived without an email in state, they might be visiting the URL directly
  // We allow them to type it in.

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await api.post('/verify-email', { email, otp });
      setMessage('Email verified successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to verify email');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('Please enter your email to resend the code.');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await api.post('/resend-otp', { email });
      setMessage('A new verification code has been sent to your email.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h2>Verify Email</h2>
        <p className="auth-subtitle">Enter the 6-digit code sent to your inbox</p>
        
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <form onSubmit={handleVerify}>
          <div className="form-group">
            <label className="form-label">DBIT Email</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="e.g. 1DB23AD001@dbit.co.in"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!initialEmail} // Lock it if passed from previous screen
            />
          </div>
          <div className="form-group">
            <label className="form-label">6-Digit Code</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="123456"
              required
              maxLength="6"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={{ letterSpacing: '0.5rem', textAlign: 'center', fontSize: '1.2rem' }}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>
        
        <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
          <p>Didn't receive the code?</p>
          <button 
            type="button" 
            className="btn btn-outline btn-block" 
            onClick={handleResend}
            disabled={loading}
            style={{ marginTop: '0.5rem' }}
          >
            Resend Code
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
