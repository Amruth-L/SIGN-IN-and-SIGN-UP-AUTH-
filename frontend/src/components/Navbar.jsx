import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, api } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [cartCount, setCartCount] = useState(0);

  const fetchCartCount = async () => {
    if (!user) {
      setCartCount(0);
      return;
    }
    try {
      const res = await api.get('/api/cart');
      setCartCount(res.data.length);
    } catch (err) {
      console.error('Failed to fetch cart count:', err);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    fetchCartCount();

    window.addEventListener('cart-updated', fetchCartCount);
    return () => {
      window.removeEventListener('cart-updated', fetchCartCount);
    };
  }, [user]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <Link to={user ? "/marketplace" : "/"} className="navbar-logo">
          Campus<span>Mesh</span>
        </Link>
        <div className="navbar-links">
          {user ? (
            <>
              <Link to="/marketplace" className="nav-link">Marketplace</Link>
              <Link to="/my-rentals" className="nav-link">My Rentals</Link>
              <Link to="/my-listings" className="nav-link">My Listings</Link>
              <Link to="/saved-items" className="nav-link">Saved Items</Link>
              <Link to="/cart" className="nav-link" style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                🛒 Cart
                {cartCount > 0 && (
                  <span className="cart-badge" style={{
                    backgroundColor: '#22c55e',
                    color: 'white',
                    borderRadius: '50%',
                    padding: '2px 6px',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    lineHeight: 1,
                    marginLeft: '5px'
                  }}>
                    {cartCount}
                  </span>
                )}
              </Link>
              <Link to="/chat" className="nav-link">Chat</Link>
              <Link to="/profile" className="nav-link">Profile</Link>
              <button onClick={logout} className="btn btn-outline nav-btn">Logout</button>
            </>
          ) : (
            <>
              <Link to="/" className="nav-link">Home</Link>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/signup" className="btn btn-primary nav-btn">Sign Up</Link>
            </>
          )}
          <button onClick={toggleTheme} className="theme-toggle-btn" aria-label="Toggle Theme">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
