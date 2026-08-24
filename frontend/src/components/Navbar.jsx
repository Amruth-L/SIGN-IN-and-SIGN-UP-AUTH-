import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  Heart,
  MessageCircle,
  User,
  Bell,
  Sun,
  Moon,
  Menu,
  X,
  Package,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, api } = useAuth();
  const location = useLocation();

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [cartCount, setCartCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ── Theme ──
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // ── Cart count ──
  const fetchCartCount = async () => {
    if (!user) { setCartCount(0); return; }
    try {
      const res = await api.get('/api/cart');
      setCartCount(Array.isArray(res.data) ? res.data.length : 0);
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    fetchCartCount();
    window.addEventListener('cart-updated', fetchCartCount);
    return () => window.removeEventListener('cart-updated', fetchCartCount);
  }, [user]);

  const isActive = (path) => location.pathname === path;

  const navLinkClass = (path) =>
    `nav-link${isActive(path) ? ' nav-link-active' : ''}`;

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-inner container">

        {/* Logo */}
        <Link
          to={user ? '/marketplace' : '/'}
          className="navbar-logo"
          aria-label="CampusMesh home"
        >
          Campus<span>Mesh</span>
        </Link>

        {/* Desktop nav */}
        <div className="navbar-links">
          {user ? (
            <>
              <Link to="/marketplace"  className={navLinkClass('/marketplace')}>Marketplace</Link>
              <Link to="/my-rentals"   className={navLinkClass('/my-rentals')}>My Rentals</Link>
              <Link to="/my-listings"  className={navLinkClass('/my-listings')}>
                <Package size={14} strokeWidth={1.75} />
                Listings
              </Link>
              <Link to="/saved-items"  className={navLinkClass('/saved-items')}>
                <Heart size={14} strokeWidth={1.75} />
                Saved
              </Link>
              <Link to="/chat" className={navLinkClass('/chat')}>
                <MessageCircle size={14} strokeWidth={1.75} />
                Chat
              </Link>
              <Link to="/cart" className={navLinkClass('/cart')} aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ''}`} style={{ position: 'relative' }}>
                <ShoppingBag size={14} strokeWidth={1.75} />
                Cart
                {cartCount > 0 && (
                  <span className="nav-cart-badge" key={cartCount}>{cartCount}</span>
                )}
              </Link>
            </>
          ) : (
            <>
              <Link to="/"       className={navLinkClass('/')}>Home</Link>
            </>
          )}
        </div>

        {/* Right actions */}
        <div className="navbar-actions">
          {/* Theme toggle */}
          <button
            id="theme-toggle-btn"
            className="nav-icon-btn"
            onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light'
              ? <Moon size={16} strokeWidth={1.75} />
              : <Sun  size={16} strokeWidth={1.75} />}
          </button>

          {user ? (
            <>
              {/* Profile avatar */}
              <Link to="/profile" className="nav-avatar" aria-label="Your profile">
                {getInitials(user?.name || user?.username)}
              </Link>

              {/* Logout */}
              <button
                id="navbar-logout-btn"
                onClick={logout}
                className="btn btn-sm btn-outline"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={navLinkClass('/login')} style={{ marginRight: '0.25rem' }}>
                Login
              </Link>
              <Link to="/signup" className="btn btn-sm btn-primary" id="navbar-signup-btn">
                Sign Up
              </Link>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            className="nav-icon-btn mobile-menu-btn"
            onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={18} strokeWidth={1.75} /> : <Menu size={18} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="mobile-nav" role="dialog" aria-modal="true" aria-label="Mobile navigation">
          {user ? (
            <>
              <Link to="/marketplace" className="mobile-nav-link">Marketplace</Link>
              <Link to="/my-rentals"  className="mobile-nav-link">My Rentals</Link>
              <Link to="/my-listings" className="mobile-nav-link">My Listings</Link>
              <Link to="/saved-items" className="mobile-nav-link">Saved Items</Link>
              <Link to="/cart"        className="mobile-nav-link">Cart {cartCount > 0 && `(${cartCount})`}</Link>
              <Link to="/chat"        className="mobile-nav-link">Chat</Link>
              <Link to="/profile"     className="mobile-nav-link">Profile</Link>
              <button onClick={logout} className="btn btn-outline btn-block" style={{ marginTop: '0.75rem' }}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/"       className="mobile-nav-link">Home</Link>
              <Link to="/login"  className="mobile-nav-link">Login</Link>
              <Link to="/signup" className="btn btn-primary btn-block" style={{ marginTop: '0.5rem' }}>Sign Up</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
