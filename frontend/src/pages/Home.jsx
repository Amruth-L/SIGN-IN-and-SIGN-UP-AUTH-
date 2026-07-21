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
  const [sortBy, setSortBy] = useState('newest');
  const [maxPrice, setMaxPrice] = useState('');
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('campusmesh_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [toastMessage, setToastMessage] = useState('');

  const categories = ['All', 'Saved ❤️', 'Books', 'Electronics', 'Stationery', 'Services', 'Other'];

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

  useEffect(() => {
    localStorage.setItem('campusmesh_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id) => {
    setFavorites(prev => {
      const isFav = prev.includes(id);
      const updated = isFav ? prev.filter(favId => favId !== id) : [...prev, id];
      setToastMessage(isFav ? 'Removed from saved items' : 'Saved to your favorites ❤️');
      setTimeout(() => setToastMessage(''), 2500);
      return updated;
    });
  };

  const handleShare = (listing) => {
    const text = `Check out "${listing.title}" on CampusMesh for ₹${listing.price}! Contact: ${listing.owner_email || 'seller'}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setToastMessage(`Copied info for "${listing.title}" to clipboard!`);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const filteredAndSortedListings = listings
    .filter(listing => {
      const matchesSearch = 
        listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = 
        selectedCategory === 'All' ? true :
        selectedCategory === 'Saved ❤️' ? favorites.includes(listing.id) :
        listing.category === selectedCategory;

      const matchesPrice = !maxPrice || parseFloat(listing.price) <= parseFloat(maxPrice);

      return matchesSearch && matchesCategory && matchesPrice;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return parseFloat(a.price) - parseFloat(b.price);
      if (sortBy === 'price_desc') return parseFloat(b.price) - parseFloat(a.price);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

  return (
    <div className="home-page container">
      {toastMessage && (
        <div className="toast-notification">
          ✨ {toastMessage}
        </div>
      )}

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

        <div className="secondary-filters">
          <div className="filter-group">
            <label className="filter-label">Max Price (₹):</label>
            <input 
              type="number" 
              placeholder="Any price" 
              value={maxPrice} 
              onChange={(e) => setMaxPrice(e.target.value)} 
              className="price-input" 
              min="0"
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Sort By:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)} 
              className="sort-select"
            >
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        <div className="category-filters">
          {categories.map(cat => (
            <button
              key={cat}
              className={`filter-tab ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat} {cat === 'Saved ❤️' && favorites.length > 0 ? `(${favorites.length})` : ''}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading listings...</div>
      ) : filteredAndSortedListings.length === 0 ? (
        <div className="empty-state">
          <p>
            {selectedCategory === 'Saved ❤️' 
              ? "You haven't saved any listings yet. Click the heart ❤️ icon on items to save them!" 
              : "No listings found. Be the first to post something!"}
          </p>
        </div>
      ) : (
        <div className="listings-grid">
          {filteredAndSortedListings.map(listing => (
            <div key={listing.id} className="card listing-card">
              <div className="listing-img-placeholder">
                {listing.image_url ? (
                  <img src={listing.image_url} alt={listing.title} />
                ) : (
                  <span>No Image</span>
                )}
                <div className="card-top-actions">
                  <button 
                    className={`fav-btn ${favorites.includes(listing.id) ? 'is-fav' : ''}`} 
                    onClick={() => toggleFavorite(listing.id)}
                    title={favorites.includes(listing.id) ? 'Remove from Saved' : 'Save Item'}
                  >
                    {favorites.includes(listing.id) ? '❤️' : '🤍'}
                  </button>
                  <button 
                    className="share-btn" 
                    onClick={() => handleShare(listing)}
                    title="Share item details"
                  >
                    🔗
                  </button>
                </div>
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
