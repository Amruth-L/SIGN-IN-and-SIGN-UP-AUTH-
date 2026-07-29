import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import './Auth.css';

const Signup = () => {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', username: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({ username: '', email: '', password: '' });

    const usernameInput = formData.username.trim().toLowerCase();
    const emailInput = formData.email.trim().toLowerCase();

    // Frontend validations
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(usernameInput)) {
      setFieldErrors(prev => ({ ...prev, username: 'Username must be 3-20 characters (alphanumeric/underscores).' }));
      return;
    }

    if (!emailInput.endsWith('@dbit.co.in')) {
      setFieldErrors(prev => ({ ...prev, email: 'Only DBIT emails (@dbit.co.in) are allowed.' }));
      return;
    }

    if (formData.password.length < 6) {
      setFieldErrors(prev => ({ ...prev, password: 'Password must be at least 6 characters.' }));
      return;
    }

    setLoading(true);

    try {
      await api.post('/signup', { 
        name: formData.name, 
        username: usernameInput, 
        email: emailInput, 
        password: formData.password 
      });
      navigate('/verify-email', { state: { email: emailInput } });
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to sign up';
      if (err.response?.status === 409) {
        if (errMsg.toLowerCase().includes('username')) {
          setFieldErrors(prev => ({ ...prev, username: errMsg }));
        } else if (errMsg.toLowerCase().includes('email')) {
          setFieldErrors(prev => ({ ...prev, email: errMsg }));
        } else {
          setError(errMsg);
        }
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h2>Create Account</h2>
        <p className="auth-subtitle">Join CampusMesh</p>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. John Doe"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. johndoe"
              required
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
            />
            {fieldErrors.username && (
              <span className="field-error-msg" style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                {fieldErrors.username}
              </span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">DBIT Email</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="Must end in @dbit.co.in"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
            {fieldErrors.email && (
              <span className="field-error-msg" style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                {fieldErrors.email}
              </span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••"
              required
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
            {fieldErrors.password && (
              <span className="field-error-msg" style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                {fieldErrors.password}
              </span>
            )}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>
        
        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in here</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
