import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { mockProducts, mockSellers } from '../data/mockData';
import './Home.css';

const Home = () => {
  const { api, user } = useAuth();
  const navigate = useNavigate();

  const [dbListings, setDbListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [sortBy, setSortBy] = useState('newest');

  // Favorites (using localStorage)
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('campusmesh_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Pagination & Load More States
  const [currentPage, setCurrentPage] = useState(1);
  const [viewLimit, setViewLimit] = useState(20);

  const categories = [
    'All',
    'Saved ❤️',
    'Books',
    'Electronics',
    'Stationery',
    'Lab Equipment',
    'Furniture',
    'Sports',
    'Kitchen',
    'Fashion',
    'Gaming',
    'Hostel Essentials'
  ];

  // Fetch listings from backend
  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await api.get('/listings');
        setDbListings(res.data);
      } catch (err) {
        console.error("Error fetching database listings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, [api]);

  // Sync favorites to localStorage
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
    const text = `Check out "${listing.title}" on CampusMesh for ₹${listing.price}! Location: ${listing.location}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setToastMessage(`Copied details for "${listing.title}" to clipboard!`);
      setTimeout(() => setToastMessage(''), 2500);
    }
  };

  // Convert raw DB listings to match product format
  const mappedDbListings = dbListings.map((listing, index) => {
    // Generate realistic details for user-submitted listings
    const seed = index + 1;
    const distanceMeters = (seed * 85) % 950 + 50; 
    
    // Assign a mock seller
    const mockSeller = mockSellers[index % mockSellers.length];

    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      category: listing.category,
      price: parseFloat(listing.price),
      rentPrice: Math.round(parseFloat(listing.price) * 0.03) || 10,
      deposit: Math.round(parseFloat(listing.price) * 0.25) || 100,
      condition: ['Like New', 'Good', 'Fair', 'New'][seed % 4],
      sellerId: mockSeller.id,
      location: ['Library', 'AI Block', 'Boys Hostel A', 'Girls Hostel', 'Main Gate', 'Sports Complex'][seed % 6],
      distance: distanceMeters,
      pickupTime: `${Math.ceil(distanceMeters / 75)} min`,
      deliveryAvailable: seed % 2 === 0,
      image_url: listing.image_url || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500&auto=format&fit=crop&q=60',
      isDbListing: true,
      owner_id: listing.owner_id
    };
  });

  // Combine database items and 100 pre-populated products
  const allProducts = [...mappedDbListings, ...mockProducts];

  // Helper: Get distance in numeric meters for sorting
  const getDistanceInMeters = (product) => {
    if (typeof product.distance === 'number') {
      return product.distance;
    }
    // Handle manual text distances or off-campus km
    const distStr = String(product.distance || '0');
    if (distStr.includes('km')) {
      return parseFloat(distStr) * 1000;
    }
    return parseFloat(distStr) || 0;
  };

  // Helper: Retrieve seller details
  const getSeller = (product) => {
    // If db listing has custom owner info, use it, else draw from mockSellers
    const seller = mockSellers.find(s => s.id === product.sellerId);
    return seller || { name: 'Student Seller', rating: 4.6, meshScore: 92 };
  };

  // Filter and Sort Listings
  const filteredAndSortedListings = allProducts
    .filter(product => {
      // 1. Category Filter
      if (selectedCategory === 'Saved ❤️') {
        if (!favorites.includes(product.id)) return false;
      } else if (selectedCategory !== 'All' && product.category !== selectedCategory) {
        return false;
      }

      // 2. Search query
      const matchesSearch = 
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // 3. Price Filter
      if (minPrice && product.price < parseFloat(minPrice)) return false;
      if (maxPrice && product.price > parseFloat(maxPrice)) return false;

      // 4. Condition Filter
      if (selectedCondition !== 'All' && product.condition !== selectedCondition) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      
      if (sortBy === 'closest') {
        return getDistanceInMeters(a) - getDistanceInMeters(b);
      }

      if (sortBy === 'rating_desc') {
        return getSeller(b).rating - getSeller(a).rating;
      }

      if (sortBy === 'mesh_desc') {
        return getSeller(b).meshScore - getSeller(a).meshScore;
      }

      // Default: newest first
      return b.id.localeCompare(a.id);
    });

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, minPrice, maxPrice, selectedCondition, sortBy]);

  // Paginated Slicing
  const totalItems = filteredAndSortedListings.length;
  const totalPages = Math.ceil(totalItems / viewLimit);
  
  const displayedListings = filteredAndSortedListings.slice(
    (currentPage - 1) * viewLimit,
    currentPage * viewLimit
  );

  const handleLoadMore = () => {
    // Double the view limit or add 20 to display more in-place
    setViewLimit(prev => Math.min(prev + 20, 100));
  };

  // Helper to format distance display beautifully
  const formatDistance = (product) => {
    const dist = product.distance;
    // On campus locations
    const onCampus = ['Library', 'AI Block', 'Boys Hostel A', 'Girls Hostel', 'Main Gate', 'Sports Complex', 'Computer Science Block', 'Parking Area'].includes(product.location);
    
    if (onCampus) {
      return `${dist} m away`;
    } else {
      // Off campus locations, format as km
      const km = (dist / 1000).toFixed(1);
      return `${km} km away`;
    }
  };

  return (
    <div className="home-page container">
      {toastMessage && (
        <div className="toast-notification">
          ✨ {toastMessage}
        </div>
      )}

      {/* Hero Header */}
      <div className="home-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>Campus Marketplace</h1>
            <p>Find textbooks, electronics, and more from fellow students.</p>
          </div>
          {user && (
            <Link to="/add-listing" className="btn btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
              + Add Listing
            </Link>
          )}
        </div>
      </div>

      {/* Filters Card Panel */}
      <div className="search-filter-container">
        {/* Search, Sort, Price & Condition Filters */}
        <div className="filter-row-top">
          {/* Search bar */}
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Search by title, author, brand or description..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Price Range Filter */}
          <div className="filter-group">
            <label>Price Range (₹)</label>
            <div className="price-inputs-row">
              <input 
                type="number" 
                placeholder="Min" 
                value={minPrice} 
                onChange={(e) => setMinPrice(e.target.value)} 
                className="price-input-box" 
                min="0"
              />
              <span className="price-divider">to</span>
              <input 
                type="number" 
                placeholder="Max" 
                value={maxPrice} 
                onChange={(e) => setMaxPrice(e.target.value)} 
                className="price-input-box" 
                min="0"
              />
            </div>
          </div>

          {/* Condition and Sort Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="filter-group">
              <label>Condition</label>
              <select 
                value={selectedCondition} 
                onChange={(e) => setSelectedCondition(e.target.value)} 
                className="condition-select"
              >
                <option value="All">All Conditions</option>
                <option value="New">New</option>
                <option value="Like New">Like New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Sort By</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)} 
                className="sort-select"
              >
                <option value="newest">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="closest">Distance: Closest</option>
                <option value="rating_desc">Rating: Highest</option>
                <option value="mesh_desc">Mesh Score: High</option>
              </select>
            </div>
          </div>
        </div>

        {/* Categories tag slider */}
        <div className="category-pills-container">
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Listings */}
      {loading ? (
        <div className="loading" style={{ padding: '6rem 0' }}>Loading student listings...</div>
      ) : displayedListings.length === 0 ? (
        <div className="empty-state" style={{ padding: '6rem 0' }}>
          <p>
            {selectedCategory === 'Saved ❤️' 
              ? "You haven't saved any listings yet. Tap the heart ❤️ icon on items to save them here!" 
              : "No listings found matching your filters. Try clearing your search or expanding the price range!"}
          </p>
        </div>
      ) : (
        <>
          <div className="marketplace-grid">
            {displayedListings.map(prod => {
              const seller = getSeller(prod);
              const initials = seller.name ? seller.name.charAt(0).toUpperCase() : 'U';
              const isFavorite = favorites.includes(prod.id);

              return (
                <div key={prod.id} className="product-card">
                  {/* Image Container with Badges */}
                  <div className="product-image-container">
                    <img src={prod.image_url} alt={prod.title} className="product-image" loading="lazy" />
                    
                    <div className="card-top-badges">
                      <span className="card-condition-badge">{prod.condition}</span>
                      {prod.deliveryAvailable && (
                        <span className="card-courier-badge">🚚 Courier</span>
                      )}
                    </div>

                    <div className="card-top-actions">
                      <button 
                        className={`action-btn-circle ${isFavorite ? 'is-fav' : ''}`}
                        onClick={() => toggleFavorite(prod.id)}
                        title={isFavorite ? 'Remove from Saved' : 'Save Item'}
                      >
                        {isFavorite ? '❤️' : '🤍'}
                      </button>
                      <button 
                        className="action-btn-circle" 
                        onClick={() => handleShare(prod)}
                        title="Copy Share Link"
                      >
                        🔗
                      </button>
                    </div>
                  </div>

                  {/* Card Body Details */}
                  <div className="product-card-body">
                    <div className="card-category-row">
                      <span className="card-category-lbl">{prod.category}</span>
                    </div>

                    <h3>{prod.title}</h3>
                    <p className="card-desc">{prod.description}</p>

                    {/* Price and Deposit metrics */}
                    <div className="prices-matrix">
                      <div className="price-item">
                        <span>Buy Price</span>
                        <strong>₹{prod.price}</strong>
                      </div>
                      <div className="price-item">
                        <span>Rent Price</span>
                        <strong className="rent-rate">₹{prod.rentPrice}/day</strong>
                      </div>
                    </div>

                    {/* Location, Distance, and Pickup Time */}
                    <div className="card-location-row">
                      <span className="location-pin">
                        📍 {prod.location}
                      </span>
                      <span className="walk-dist">
                        🚶 {formatDistance(prod)}
                      </span>
                      <span className="walk-dist" style={{ opacity: 0.85 }}>
                        ⏱️ {prod.pickupTime}
                      </span>
                    </div>

                    {/* Seller badge bar */}
                    <div className="seller-badge-bar">
                      <div className="seller-avatar-mini" title={`${seller.name} (${seller.department})`}>
                        {initials}
                      </div>
                      <div className="seller-details-mini">
                        <span className="seller-name-mini">{seller.name}</span>
                        <span className="seller-rating-mini">⭐ {seller.rating}</span>
                      </div>
                      <span className="seller-mesh-score" title="Campus Trust Score">
                        🛡️ Mesh: {seller.meshScore}
                      </span>
                    </div>

                    {/* Rent & Chat buttons */}
                    <div className="card-action-buttons">
                      {user ? (
                        prod.isDbListing && prod.owner_id === user.id ? (
                          <div style={{ gridColumn: 'span 2', textAlign: 'center', fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 'bold', border: '1px dashed var(--primary-color)', padding: '0.45rem', borderRadius: 'var(--radius-md)' }}>
                            Your Active Listing
                          </div>
                        ) : (
                          <>
                            <Link to={`/rent-item/${prod.id}`} className="btn btn-primary btn-card">
                              Rent Now
                            </Link>
                            <Link 
                              to={`/chat?sellerId=${prod.sellerId}&sellerName=${encodeURIComponent(seller.name)}&listingTitle=${encodeURIComponent(prod.title)}`} 
                              className="btn btn-outline btn-card"
                            >
                              Chat Seller
                            </Link>
                          </>
                        )
                      ) : (
                        <button onClick={() => navigate('/login')} className="btn btn-outline btn-card" style={{ gridColumn: 'span 2' }}>
                          Login to Rent/Chat
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination-controls">
              {displayedListings.length < totalItems && (
                <button 
                  onClick={handleLoadMore} 
                  className="btn btn-primary load-more-btn"
                  style={{ marginBottom: '1rem' }}
                >
                  Load More Listings
                </button>
              )}
              
              <div className="pagination-pages">
                <button 
                  className="page-btn" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  title="Previous Page"
                >
                  ←
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button 
                    key={i} 
                    className={`page-btn ${currentPage === i + 1 ? 'active' : ''}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
                <button 
                  className="page-btn" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  title="Next Page"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Home;
