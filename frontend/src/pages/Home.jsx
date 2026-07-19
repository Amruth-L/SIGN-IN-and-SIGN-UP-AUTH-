import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const { api, user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Books', 'Electronics', 'Stationery', 'Services', 'Other'];

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await api.get('/listings');
        setListings(res.data);
      } catch (err) {
        console.error("Error fetching listings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, [api]);

  const filteredListings = listings.filter(listing => {
    const matchesSearch = 
      listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = 
      selectedCategory === 'All' || 
      listing.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="home-page container">
      <div className="home-header">
        <div>
          <h1>CAMPUSMESH</h1>
          <p className="text-muted">Find textbooks, electronics, and more from fellow students.</p>
        </div>
        {user && (
          <Link to="/add-listing" className="btn btn-primary">
            + Add Listing
          </Link>
        )}
      </div>

      <div className="search-filter-container">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            placeholder="Search listings by title or description..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="category-filters">
          {categories.map(cat => (
            <button
              key={cat}
              className={`filter-tab ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading listings...</div>
      ) : filteredListings.length === 0 ? (
        <div className="empty-state">
          <p>No listings found. Be the first to post something!</p>
        </div>
      ) : (
        <div className="listings-grid">
          {filteredListings.map(listing => (
            <div key={listing.id} className="card listing-card">
              <div className="listing-img-placeholder">
                {listing.image_url ? (
                  <img src={listing.image_url} alt={listing.title} />
                ) : (
                  <span>No Image</span>
                )}
              </div>
              <div className="listing-content">
                <span className="listing-category">{listing.category}</span>
                <h3>{listing.title}</h3>
                <p className="listing-price">₹{listing.price}</p>
                <p className="listing-desc">{listing.description}</p>
                
                <div className="listing-footer">
                  <div className="seller-info">
                    <span className="seller-icon">👤</span>
                    <div>
                      <p className="seller-name">{listing.owner_name || 'Anonymous'}</p>
                      <p className="seller-label">Seller</p>
                    </div>
                  </div>
                  {user ? (
                    <a 
                      href={`mailto:${listing.owner_email}?subject=Inquiry about ${encodeURIComponent(listing.title)}`} 
                      className="btn btn-outline btn-sm contact-btn"
                    >
                      Contact Seller
                    </a>
                  ) : (
                    <Link to="/login" className="btn btn-outline btn-sm contact-btn login-to-contact">
                      Login to Contact
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
