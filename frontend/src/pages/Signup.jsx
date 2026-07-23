import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import './Auth.css';

const Signup = () => {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const emailInput = formData.email.trim().toLowerCase();
    if (!emailInput.endsWith('@dbit.co.in')) {
      setError('Only DBIT emails (@dbit.co.in) are allowed');
      return;
    }

    setLoading(true);

    try {
      await api.post('/signup', { ...formData, email: emailInput });
      // Redirect to verification page and pass the email they just used
      navigate('/verify-email', { state: { email: emailInput } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to sign up');
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
            <label className="form-label">DBIT Email</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="Must end in @dbit.co.in"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
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
