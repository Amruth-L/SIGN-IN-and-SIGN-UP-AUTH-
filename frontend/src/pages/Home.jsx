import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import './Home.css';

const Home = ({ marketplaceOnly = false }) => {
  const { api, user } = useAuth();
  const navigate = useNavigate();

  const [dbListings, setDbListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [savingFavorites, setSavingFavorites] = useState({});

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
    if (!marketplaceOnly) {
      setLoading(false);
      return;
    }

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
  }, [api, marketplaceOnly]);

  // Sync favorites to localStorage
  useEffect(() => {
    localStorage.setItem('campusmesh_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Keep the home-page heart and Profile > Saved Items backed by the same
  // database source for authenticated users. Unauthenticated users still get
  // a local-only save until they log in.
  useEffect(() => {
    if (!user) return;

    let active = true;
    api.get('/api/wishlist')
      .then((res) => {
        if (!active) return;
        const savedIds = res.data.map((item) => item.id);
        setFavorites(savedIds);
        localStorage.setItem('campusmesh_favorites', JSON.stringify(savedIds));
      })
      .catch((err) => {
        console.error('Error fetching saved items:', err);
      });

    return () => {
      active = false;
    };
  }, [user, api]);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const toggleFavorite = async (id) => {
    const isFav = favorites.includes(id);

    if (!user) {
      setFavorites(prev => isFav ? prev.filter(favId => favId !== id) : [...prev, id]);
      showToast(isFav ? 'Removed from saved items' : 'Saved to your favorites ❤️');
      return;
    }

    if (savingFavorites[id]) return;
    setSavingFavorites(prev => ({ ...prev, [id]: true }));

    try {
      const res = await api.post('/api/wishlist/toggle', { item_id: id });
      const saved = res.data.saved;
      setFavorites(prev => saved
        ? (prev.includes(id) ? prev : [...prev, id])
        : prev.filter(favId => favId !== id)
      );
      showToast(saved ? 'Saved to your favorites ❤️' : 'Removed from saved items');
    } catch (err) {
      console.error('Error saving item:', err);
      showToast(err.response?.data?.error || 'Unable to save this item. Please try again.');
    } finally {
      setSavingFavorites(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
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
  const mappedDbListings = dbListings.map((listing) => {
    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      category: listing.category,
      price: parseFloat(listing.price),
      rentPrice: parseFloat(listing.rent_price) || 0,
      deposit: parseFloat(listing.deposit) || 0,
      condition: listing.condition || 'Not specified',
      sellerId: listing.owner_id,
      seller: { name: listing.owner_name || 'Verified student', rating: null, meshScore: null },
      location: listing.location || 'Campus pickup',
      distance: null,
      pickupTime: listing.pickup_time || 'To be arranged',
      deliveryAvailable: !!listing.delivery_available,
      image_url: listing.image_url || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500&auto=format&fit=crop&q=60',
      isDbListing: true,
      owner_id: listing.owner_id
    };
  });

  // Load products directly from the backend database (pre-seeded with all mock products)
  const allProducts = mappedDbListings;

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
  const getSeller = (product) => product.seller || { name: 'Verified student', rating: null, meshScore: null };

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
        return (getSeller(b).rating || 0) - (getSeller(a).rating || 0);
      }

      if (sortBy === 'mesh_desc') {
        return (getSeller(b).meshScore || 0) - (getSeller(a).meshScore || 0);
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
    if (typeof dist !== 'number') return 'Campus pickup';
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

  const scrollToMarketplace = () => {
    if (!marketplaceOnly) {
      navigate('/marketplace');
      return;
    }
    document.getElementById('marketplace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const workflow = [
    ['01', 'Sign up', 'Create your account using your campus identity.'],
    ['02', 'Find an item', 'Browse items listed by other students.'],
    ['03', 'Choose', 'Choose whether you want to Rent or Borrow.'],
    ['04', 'Select dates', 'Choose how long you need the item.'],
    ['05', 'Send request', 'Send a request to the student who owns the item.'],
    ['06', 'Owner accepts', 'The owner reviews and accepts your request.'],
    ['07', 'Payment', 'For rentals, pay the rental fee, platform fee and applicable delivery fee.'],
    ['08', 'Security deposit', 'If required, pay the refundable security deposit before receiving the item.'],
    ['09', 'Handover', 'Complete the secure handover and receive the item.'],
    ['10', 'Use', 'Use the item during your selected rental period.'],
    ['11', 'Return', 'Return the item when the rental period ends.'],
    ['12', 'Refund', 'Your security deposit is refunded after the item is returned safely.']
  ];

  const borrowerJourney = ['Search', 'Select item', 'Choose Rent / Borrow', 'Select dates', 'Send request', 'Owner accepts', 'Payment', 'Receive item', 'Use item', 'Return item'];
  const ownerJourney = ['List item', 'Upload photos', 'Add condition', 'Set Rent / Borrow option', 'Set security deposit', 'Choose pickup location', 'Receive request', 'Accept request', 'Handover item', 'Receive rental earnings'];

  return (
    <div className="home-page container">
      {toastMessage && (
        <div className="toast-notification">
          ✨ {toastMessage}
        </div>
      )}

      {!marketplaceOnly && <>
      <section className="campus-hero">
        <div className="hero-copy">
          <span className="eyebrow">A verified student community</span>
          <h1>Rent. Borrow. Share. <span>Campus.</span></h1>
          <p>CampusMesh connects verified students with the things they need — without having to buy everything themselves.</p>
          <div className="hero-actions">
            <a href="#how-it-works" className="btn btn-primary">Explore CampusMesh</a>
            <Link to="/signup" className="btn btn-outline">Sign Up</Link>
          </div>
          <div className="hero-proof"><span>✓ Verified students</span><span>✓ Safer handovers</span><span>✓ Refundable deposits</span></div>
        </div>
        <div className="sharing-illustration" aria-label="Students sharing books, a calculator, laptop, sports and lab equipment">
          <div className="illustration-orbit orbit-one">⌗</div>
          <div className="illustration-orbit orbit-two">⚗</div>
          <div className="illustration-orbit orbit-three">⚽</div>
          <div className="student student-one"><span>👩🏽‍🎓</span><small>Books</small></div>
          <div className="student student-two"><span>👨🏽‍🎓</span><small>Laptop</small></div>
          <div className="shared-kit"><span>🧮</span><span>💻</span><span>📚</span></div>
          <div className="share-line" />
          <p>Useful things, shared nearby.</p>
        </div>
      </section>

      <section className="info-section what-section">
        <div className="section-heading centered-heading">
          <span className="eyebrow">Made for campus life</span>
          <h2>What is CampusMesh?</h2>
          <p>CampusMesh is a student-only peer-to-peer marketplace where students can rent, borrow and share useful items with other verified students.</p>
        </div>
        <div className="purpose-grid">
          {[
            ['₹', 'Rent', 'Need something for a few days? Rent it from another student instead of buying it.'],
            ['↗', 'Borrow', 'Only need something temporarily? Borrow it from a student who is willing to share.'],
            ['✦', 'List', "Have something you don't use every day? List it and let another student use it."]
          ].map(([icon, title, copy]) => <article className="purpose-card" key={title}><span className="purpose-icon">{icon}</span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>

      <section className="info-section workflow-section" id="how-it-works">
        <div className="section-heading centered-heading">
          <span className="eyebrow">One clear journey</span>
          <h2>How CampusMesh Works</h2>
          <p>From finding an item to returning it — everything happens in a few simple steps.</p>
        </div>
        <div className="workflow-track">
          {workflow.map(([number, title, copy]) => <article className="workflow-step" key={number}><span className="workflow-number">{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>

      <section className="info-section journey-grid">
        <article className="journey-card borrower-card">
          <div><span className="eyebrow">Borrower journey</span><h2>Need Something?</h2><p>Find what you need, request it from a fellow student, and return it when you’re done.</p></div>
          <ol className="compact-timeline">{borrowerJourney.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>)}</ol>
          <button className="btn btn-primary" onClick={scrollToMarketplace}>Find Something You Need</button>
        </article>
        <article className="journey-card owner-card">
          <div><span className="eyebrow">Owner journey</span><h2>Have Something Another Student Might Need?</h2><p>Turn unused items into useful income — or simply help another student out.</p></div>
          <ol className="compact-timeline">{ownerJourney.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>)}</ol>
          <Link to={user ? "/create-listing" : "/login"} className="btn btn-primary">List an Item</Link>
        </article>
      </section>

      <section className="info-section" id="rent-borrow">
        <div className="section-heading centered-heading"><span className="eyebrow">Choose what works</span><h2>Rent or Borrow — You Choose</h2></div>
        <div className="comparison-grid">
          <article className="comparison-card"><span className="comparison-label">Rent</span><h3>Use it for the time you need</h3><p>Pay a small amount to use an item for the time you need.</p><div className="comparison-example"><strong>Scientific Calculator</strong><b>₹10/day</b></div><p><strong>Payment:</strong> Rental fee + platform fee + delivery fee</p><button className="btn btn-primary" onClick={scrollToMarketplace}>Rent Now</button></article>
          <article className="comparison-card borrow"><span className="comparison-label">Borrow</span><h3>Use it for free</h3><p>Use an item for free when another student is willing to share it.</p><div className="comparison-example"><strong>Scientific Calculator</strong><b>Free Borrow</b></div><p><strong>Remember:</strong> Security deposits may apply even when the rental fee is ₹0.</p><button className="btn btn-outline" onClick={scrollToMarketplace}>Borrow</button></article>
        </div>
      </section>

      <section className="info-section payment-section">
        <div className="section-heading centered-heading"><span className="eyebrow">No hidden surprises</span><h2>Simple and Transparent Payments</h2><p>Rental fee + platform fee + delivery fee = booking payment.</p></div>
        <div className="payment-stages"><article><span>Step 1</span><h3>Booking payment</h3><p>Rental fee + delivery fee + platform fee</p><i>↓</i><strong>Owner accepts</strong></article><article><span>Step 2</span><h3>Security deposit</h3><p>Refundable security deposit</p><i>↓</i><strong>Item handover → rental ends → item returned → refund</strong></article></div>
        <p className="deposit-note">Your security deposit is separate from the rental fee and is refundable when the item is returned safely.</p>
      </section>

      <section className="info-section money-section">
        <div className="section-heading"><span className="eyebrow">Clear for everyone</span><h2>Where Does Your Money Go?</h2><p>Every part of the payment has a simple destination.</p></div>
        <div className="money-flow">
          {[['Rental fee', '₹20', 'Item owner', '₹20'], ['Delivery fee', '₹5', 'Student courier', '₹5'], ['Platform fee', '₹1.25', 'CampusMesh', '₹1.25'], ['Security deposit', '₹200', 'Held separately', 'Refunded after successful return']].map(([label, amount, destination, result]) => <div className="money-item" key={label}><span>{label}</span><b>{amount}</b><i>↓</i><strong>{destination}</strong><small>{result}</small></div>)}
        </div>
      </section>

      <section className="info-section handover-section" id="safety">
        <div className="section-heading centered-heading"><span className="eyebrow">Confidence at every exchange</span><h2>Every Handover Matters</h2><p>When students exchange valuable items, both sides need confidence.</p></div>
        <div className="handover-flow"><div>Owner</div><span>↓</span><strong>▣<small>QR verification</small></strong><span>↓</span><div>Item handover</div><span>↓</span><div>Borrower</div></div>
        <div className="return-flow">Return <span>↓</span> QR verification <span>↓</span> Owner</div>
        <div className="trust-points"><span>✓ Item condition photos</span><span>✓ QR verification</span><span>✓ Rental history</span><span>✓ Ratings</span><span>✓ Dispute support</span></div>
      </section>

      <section className="info-section community-section" id="about">
        <div className="section-heading centered-heading"><span className="eyebrow">A safer campus marketplace</span><h2>Built for a Trusted Campus Community</h2></div>
        <div className="community-points">{['Verified student accounts', 'Student ratings', 'Rental history', 'Secure payments', 'Refundable deposits', 'Verified handovers', 'Dispute support'].map(point => <span key={point}>✓ {point}</span>)}</div>
      </section>

      <section className="info-section popular-section">
        <div className="section-heading"><span className="eyebrow">Start exploring</span><h2>Popular Categories</h2></div>
        <div className="popular-categories">{['Books', 'Calculators', 'Electronics', 'Lab Equipment', 'Sports Equipment', 'Stationery', 'Tools', 'Clothing', 'Hostel Essentials', 'Study Materials'].map(category => <button key={category} onClick={scrollToMarketplace}>{category}<span>→</span></button>)}</div>
      </section>

      </>}

      {marketplaceOnly && <>
      <section className="marketplace-section" id="marketplace">
        <div className="home-header"><span className="eyebrow">From verified student listings</span><h2>Things Students Are Sharing</h2><p>Browse real listings from the CampusMesh marketplace.</p></div>

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
                        <span>Borrow</span>
                        <strong className="borrow-available">Available on request</strong>
                      </div>
                      <div className="price-item">
                        <span>Rent Price</span>
                        <strong className="rent-rate">₹{prod.rentPrice}/day</strong>
                      </div>
                      <div className="price-item">
                        <span>Security Deposit</span>
                        <strong>₹{prod.deposit}</strong>
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
                        <span className="seller-rating-mini">{seller.rating ? `⭐ ${seller.rating}` : '✓ Verified student'}</span>
                      </div>
                      {seller.meshScore && <span className="seller-mesh-score" title="Campus Trust Score">🛡️ Mesh: {seller.meshScore}</span>}
                    </div>

                    {/* Existing rental and student-to-student request actions */}
                    <div className="card-action-buttons">
                      {user ? (
                        prod.isDbListing && prod.owner_id === user.id ? (
                          <div style={{ gridColumn: 'span 2', textAlign: 'center', fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 'bold', border: '1px dashed var(--primary-color)', padding: '0.45rem', borderRadius: 'var(--radius-md)' }}>
                            Your Active Listing
                          </div>
                        ) : (
                          <>
                            <Link to={`/item/${prod.id}`} className="btn btn-primary btn-card">
                              Rent Now
                            </Link>
                            <Link 
                              to={`/chat?sellerId=${prod.sellerId}&sellerName=${encodeURIComponent(seller.name)}&listingTitle=${encodeURIComponent(prod.title)}`} 
                              className="btn btn-outline btn-card"
                            >
                              Borrow
                            </Link>
                          </>
                        )
                      ) : (
                        <button onClick={() => navigate('/login')} className="btn btn-outline btn-card" style={{ gridColumn: 'span 2' }}>
                          Login to Rent / Borrow
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
      </section>
      </>}

      {!marketplaceOnly && <>
      <section className="final-cta">
        <div><span className="eyebrow">Ready when you are</span><h2>Ready to Rent, Borrow or Share?</h2><p>Join your campus community and make useful things easier to access.</p><Link to="/signup" className="btn btn-primary">Sign Up</Link></div>
        <div><span className="eyebrow">Already a member?</span><h2>Use CampusMesh today.</h2><p>Log in to browse listings, manage rentals, and share your useful things.</p><Link to="/login" className="btn btn-outline">Login</Link></div>
      </section>

      <footer className="campus-footer">
        <div><Link to="/" className="footer-logo">Campus<span>Mesh</span></Link><p>Rent less. Share more. Save together.</p></div>
        <div className="footer-links"><Link to="/marketplace">Marketplace</Link><a href="#how-it-works">How It Works</a><Link to="/signup">Create Account</Link><a href="#safety">Safety</a><a href="mailto:support@campusmesh.local">Help</a><a href="#privacy">Privacy</a><a href="#terms">Terms</a></div>
      </footer>
      </>}
    </div>
  );
};

export default Home;
