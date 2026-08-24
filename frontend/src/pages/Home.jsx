import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Heart,
  Share2,
  MapPin,
  Clock,
  Navigation,
  ShieldCheck,
  Users,
  Star,
  ArrowRight,
  Package,
  Truck,
  RefreshCw,
  X,
  BookOpen,
  Calculator,
  Laptop,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { MarketplaceSkeleton } from '../components/ui/Skeleton';
import './Home.css';

const Home = ({ marketplaceOnly = false }) => {
  const { api, user } = useAuth();
  const navigate = useNavigate();

  const [dbListings, setDbListings]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [savingFavorites, setSavingFavorites] = useState({});

  // Search & Filter
  const [searchQuery, setSearchQuery]           = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minPrice, setMinPrice]                 = useState('');
  const [maxPrice, setMaxPrice]                 = useState('');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [sortBy, setSortBy]                     = useState('newest');
  const [deliveryModeOnly, setDeliveryModeOnly] = useState(false);
  const [rentalModeOnly, setRentalModeOnly]     = useState(false);

  // Favorites
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('campusmesh_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [viewLimit, setViewLimit]     = useState(20);

  const categories = [
    'All', 'Saved', 'Books', 'Electronics', 'Stationery',
    'Lab Equipment', 'Furniture', 'Sports', 'Kitchen',
    'Fashion', 'Gaming', 'Hostel Essentials'
  ];

  useEffect(() => {
    if (!marketplaceOnly) { setLoading(false); return; }
    const fetchListings = async () => {
      try {
        const res = await api.get('/listings');
        setDbListings(res.data);
      } catch (err) {
        console.error('Error fetching listings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, [api, marketplaceOnly]);

  useEffect(() => {
    localStorage.setItem('campusmesh_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    api.get('/api/wishlist')
      .then(res => {
        if (!active) return;
        const savedIds = res.data.map(item => item.id);
        setFavorites(savedIds);
        localStorage.setItem('campusmesh_favorites', JSON.stringify(savedIds));
      })
      .catch(err => console.error('Error fetching saved items:', err));
    return () => { active = false; };
  }, [user, api]);

  const showToast = message => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const toggleFavorite = async id => {
    const isFav = favorites.includes(id);
    if (!user) {
      setFavorites(prev => {
        const updated = isFav ? prev.filter(fId => fId !== id) : [...prev, id];
        localStorage.setItem('campusmesh_favorites', JSON.stringify(updated));
        return updated;
      });
      showToast(isFav ? 'Removed from saved' : 'Saved to your list');
      return;
    }
    if (savingFavorites[id]) return;
    setSavingFavorites(prev => ({ ...prev, [id]: true }));
    try {
      const res = await api.post('/api/wishlist/toggle', { item_id: id });
      const saved = res.data.saved;
      setFavorites(prev => {
        const updated = saved
          ? (prev.includes(id) ? prev : [...prev, id])
          : prev.filter(fId => fId !== id);
        localStorage.setItem('campusmesh_favorites', JSON.stringify(updated));
        return updated;
      });
      showToast(saved ? 'Saved to your list' : 'Removed from saved');
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to save. Please try again.');
    } finally {
      setSavingFavorites(prev => { const next = { ...prev }; delete next[id]; return next; });
    }
  };

  const handleShare = listing => {
    const text = `Check out "${listing.title}" on CampusMesh for ₹${listing.price}! Location: ${listing.location}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast(`Link copied for "${listing.title}"`);
    }
  };

  // Map DB listings
  const mappedDbListings = dbListings.map(listing => ({
    id:               listing.id,
    title:            listing.title,
    description:      listing.description,
    category:         listing.category,
    price:            parseFloat(listing.price),
    rentPrice:        parseFloat(listing.rent_price) || 0,
    deposit:          parseFloat(listing.deposit) || 0,
    condition:        listing.condition || 'Not specified',
    sellerId:         listing.owner_id,
    seller:           { name: listing.owner_name || 'Verified student', rating: null, meshScore: null },
    location:         listing.location || 'Campus pickup',
    distance:         null,
    pickupTime:       listing.pickup_time || 'To be arranged',
    deliveryAvailable: !!listing.delivery_available,
    image_url:        listing.image_url || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500&auto=format&fit=crop&q=60',
    isDbListing:      true,
    owner_id:         listing.owner_id,
  }));

  const allProducts = mappedDbListings;

  const getDistanceInMeters = product => {
    if (typeof product.distance === 'number') return product.distance;
    const distStr = String(product.distance || '0');
    if (distStr.includes('km')) return parseFloat(distStr) * 1000;
    return parseFloat(distStr) || 0;
  };

  const getSeller = product => product.seller || { name: 'Verified student', rating: null, meshScore: null };

  // Filter & sort
  const filteredAndSortedListings = allProducts
    .filter(product => {
      if (selectedCategory === 'Saved') {
        if (!favorites.includes(product.id)) return false;
      } else if (selectedCategory !== 'All' && product.category !== selectedCategory) {
        return false;
      }
      const matchesSearch =
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (minPrice && product.price < parseFloat(minPrice)) return false;
      if (maxPrice && product.price > parseFloat(maxPrice)) return false;
      if (selectedCondition !== 'All' && product.condition !== selectedCondition) return false;
      if (deliveryModeOnly && !product.deliveryAvailable) return false;
      if (rentalModeOnly && (!product.rentPrice || product.rentPrice <= 0)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc')    return a.price - b.price;
      if (sortBy === 'price_desc')   return b.price - a.price;
      if (sortBy === 'closest')      return getDistanceInMeters(a) - getDistanceInMeters(b);
      if (sortBy === 'rating_desc')  return (getSeller(b).rating || 0) - (getSeller(a).rating || 0);
      if (sortBy === 'mesh_desc')    return (getSeller(b).meshScore || 0) - (getSeller(a).meshScore || 0);
      const numA = Number(a.id); const numB = Number(b.id);
      if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

  useEffect(() => { setCurrentPage(1); }, [selectedCategory, searchQuery, minPrice, maxPrice, selectedCondition, sortBy, deliveryModeOnly, rentalModeOnly]);

  const totalItems    = filteredAndSortedListings.length;
  const totalPages    = Math.ceil(totalItems / viewLimit);
  const displayedListings = filteredAndSortedListings.slice((currentPage - 1) * viewLimit, currentPage * viewLimit);

  const handleLoadMore = () => setViewLimit(prev => Math.min(prev + 20, 100));

  const formatDistance = product => {
    const dist = product.distance;
    if (typeof dist !== 'number') return 'Campus pickup';
    const onCampus = ['Library', 'AI Block', 'Boys Hostel A', 'Girls Hostel', 'Main Gate', 'Sports Complex', 'Computer Science Block', 'Parking Area'].includes(product.location);
    return onCampus ? `${dist} m away` : `${(dist / 1000).toFixed(1)} km away`;
  };

  const scrollToMarketplace = () => {
    if (!marketplaceOnly) { navigate('/marketplace'); return; }
    document.getElementById('marketplace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // How it works steps
  const workflow = [
    ['01', 'Sign up',          'Create your account using your campus identity.'],
    ['02', 'Find an item',     'Browse items listed by other students.'],
    ['03', 'Choose',           'Decide whether to Rent or Borrow.'],
    ['04', 'Select dates',     'Choose how long you need the item.'],
    ['05', 'Send request',     'Send a rental request to the item owner.'],
    ['06', 'Owner accepts',    'The owner reviews and accepts your request.'],
    ['07', 'Payment',          'For rentals, pay the rental + platform + delivery fee.'],
    ['08', 'Security deposit', 'Pay the refundable security deposit if required.'],
    ['09', 'Handover',         'Complete secure QR handover and receive the item.'],
    ['10', 'Use',              'Use the item during your rental period.'],
    ['11', 'Return',           'Return the item when the period ends.'],
    ['12', 'Refund',           'Your security deposit is refunded after safe return.'],
  ];

  const borrowerJourney = ['Search', 'Select item', 'Choose Rent / Borrow', 'Select dates', 'Send request', 'Owner accepts', 'Payment', 'Receive item', 'Use item', 'Return item'];
  const ownerJourney    = ['List item', 'Upload photos', 'Add condition', 'Set Rent / Borrow', 'Set security deposit', 'Choose pickup location', 'Receive request', 'Accept request', 'Handover item', 'Receive earnings'];

  return (
    <div className="home-page">
      {/* Toast */}
      {toastMessage && (
        <div className="toast-notification" role="status">{toastMessage}</div>
      )}

      {/* ════════════════════════════════════════
          PUBLIC LANDING SECTIONS
          ════════════════════════════════════════ */}
      {!marketplaceOnly && (
        <>
          {/* Hero */}
          <section className="campus-hero container">
            <div className="hero-copy">
              <span className="eyebrow">A verified student community</span>
              <h1>Rent. Borrow. Share.<br /><span className="hero-green">Campus.</span></h1>
              <p className="hero-sub">
                Access the things you need from students around you — without buying everything yourself.
              </p>
              <div className="hero-actions">
                <button className="btn btn-primary" onClick={scrollToMarketplace}>
                  Explore Marketplace <ArrowRight size={15} strokeWidth={2} />
                </button>
                <Link to="/signup" className="btn btn-outline">List an Item</Link>
              </div>
              <div className="hero-proof">
                <span><ShieldCheck size={13} strokeWidth={2} /> Verified students</span>
                <span><ShieldCheck size={13} strokeWidth={2} /> Safer handovers</span>
                <span><ShieldCheck size={13} strokeWidth={2} /> Refundable deposits</span>
              </div>
            </div>

            {/* Illustration: item preview cards */}
            <div className="hero-illustration" aria-hidden="true">
              <div className="hero-card hero-card-1">
                <div className="hero-card-icon"><BookOpen size={20} strokeWidth={1.5} /></div>
                <div>
                  <div className="hero-card-name">Engineering Maths</div>
                  <div className="hero-card-meta">₹8/day · RENT</div>
                </div>
              </div>
              <div className="hero-card hero-card-2">
                <div className="hero-card-icon"><Calculator size={20} strokeWidth={1.5} /></div>
                <div>
                  <div className="hero-card-name">Scientific Calculator</div>
                  <div className="hero-card-meta">Free · BORROW</div>
                </div>
              </div>
              <div className="hero-card hero-card-3">
                <div className="hero-card-icon"><Laptop size={20} strokeWidth={1.5} /></div>
                <div>
                  <div className="hero-card-name">Laptop Stand</div>
                  <div className="hero-card-meta">₹15/day · RENT</div>
                </div>
              </div>
              <div className="hero-verified-badge">
                <ShieldCheck size={14} strokeWidth={2} />
                <span>Verified students only</span>
              </div>
            </div>
          </section>

          {/* What is CampusMesh */}
          <section className="info-section what-section">
            <div className="container">
              <div className="section-heading centered-heading">
                <span className="eyebrow">Made for campus life</span>
                <h2>What is CampusMesh?</h2>
                <p>A student-only peer-to-peer marketplace where verified students can rent, borrow and share useful items.</p>
              </div>
              <div className="purpose-grid">
                {[
                  [Package,     'Rent',    'Need something for a few days? Rent it from another student instead of buying.'],
                  [ArrowRight,  'Borrow',  'Only need it temporarily? Borrow it from a student who is willing to share.'],
                  [Layers,      'List',    "Have something unused? List it and earn from items already sitting on your shelf."],
                ].map(([Icon, title, copy]) => (
                  <article className="purpose-card" key={title}>
                    <span className="purpose-icon"><Icon size={18} strokeWidth={1.75} /></span>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="info-section workflow-section" id="how-it-works">
            <div className="container">
              <div className="section-heading centered-heading">
                <span className="eyebrow">One clear journey</span>
                <h2>How CampusMesh Works</h2>
                <p>From finding an item to returning it — everything in a few simple steps.</p>
              </div>
              <div className="workflow-track">
                {workflow.map(([number, title, copy]) => (
                  <article className="workflow-step" key={number}>
                    <span className="workflow-number">{number}</span>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* Borrower & Owner journeys */}
          <section className="info-section journey-grid">
            <div className="container">
              <article className="journey-card borrower-card">
                <div>
                  <span className="eyebrow">Borrower journey</span>
                  <h2>Need Something?</h2>
                  <p>Find what you need, request it from a fellow student, and return it when done.</p>
                </div>
                <ol className="compact-timeline">
                  {borrowerJourney.map((step, i) => (
                    <li key={step}><span>{String(i + 1).padStart(2, '0')}</span>{step}</li>
                  ))}
                </ol>
                <button className="btn btn-primary" onClick={scrollToMarketplace}>
                  Find Something <ArrowRight size={14} strokeWidth={2} />
                </button>
              </article>

              <article className="journey-card owner-card">
                <div>
                  <span className="eyebrow">Owner journey</span>
                  <h2>Have Something Another Student Might Need?</h2>
                  <p>Turn unused items into useful income — or simply help a fellow student.</p>
                </div>
                <ol className="compact-timeline">
                  {ownerJourney.map((step, i) => (
                    <li key={step}><span>{String(i + 1).padStart(2, '0')}</span>{step}</li>
                  ))}
                </ol>
                <Link to={user ? '/create-listing' : '/login'} className="btn btn-primary">
                  List an Item <ArrowRight size={14} strokeWidth={2} />
                </Link>
              </article>
            </div>
          </section>

          {/* Rent or Borrow */}
          <section className="info-section" id="rent-borrow">
            <div className="container">
              <div className="section-heading centered-heading">
                <span className="eyebrow">Choose what works</span>
                <h2>Rent or Borrow — You Choose</h2>
              </div>
              <div className="comparison-grid">
                <article className="comparison-card">
                  <span className="comparison-label badge-rent-label">Rent</span>
                  <h3>Use it for the time you need</h3>
                  <p>Pay a small amount to use an item for as long as you need.</p>
                  <div className="comparison-example">
                    <strong>Scientific Calculator</strong>
                    <b>₹10/day</b>
                  </div>
                  <p><strong>Payment:</strong> Rental fee + platform fee + delivery fee</p>
                  <button className="btn btn-primary btn-sm" onClick={scrollToMarketplace}>
                    Rent Now <ArrowRight size={13} strokeWidth={2} />
                  </button>
                </article>
                <article className="comparison-card borrow">
                  <span className="comparison-label badge-borrow-label">Borrow</span>
                  <h3>Use it for free</h3>
                  <p>Use an item for free when another student is willing to share.</p>
                  <div className="comparison-example">
                    <strong>Scientific Calculator</strong>
                    <b>Free Borrow</b>
                  </div>
                  <p><strong>Note:</strong> Security deposits may apply even when rental fee is ₹0.</p>
                  <button className="btn btn-outline btn-sm" onClick={scrollToMarketplace}>
                    Browse Free Items
                  </button>
                </article>
              </div>
            </div>
          </section>

          {/* Payment */}
          <section className="info-section payment-section">
            <div className="container">
              <div className="section-heading centered-heading">
                <span className="eyebrow">No hidden surprises</span>
                <h2>Simple and Transparent Payments</h2>
                <p>Rental fee + platform fee + delivery fee = your booking payment.</p>
              </div>
              <div className="payment-stages">
                <article>
                  <span>Step 1</span>
                  <h3>Booking payment</h3>
                  <p>Rental fee + delivery fee + platform fee</p>
                  <ChevronRight size={16} strokeWidth={1.75} style={{ color: 'var(--color-primary)' }} />
                  <strong>Owner accepts</strong>
                </article>
                <article>
                  <span>Step 2</span>
                  <h3>Security deposit</h3>
                  <p>Refundable security deposit</p>
                  <ChevronRight size={16} strokeWidth={1.75} style={{ color: 'var(--color-primary)' }} />
                  <strong>Item handover → rental ends → return → refund</strong>
                </article>
              </div>
              <p className="deposit-note">
                Your security deposit is separate from the rental fee and is refunded when the item is returned safely.
              </p>
            </div>
          </section>

          {/* Handover / Safety */}
          <section className="info-section handover-section" id="safety">
            <div className="container">
              <div className="section-heading centered-heading">
                <span className="eyebrow">Confidence at every exchange</span>
                <h2>Every Handover Matters</h2>
                <p>When students exchange valuable items, both sides need confidence.</p>
              </div>
              <div className="trust-points">
                {['Item condition photos', 'QR verification', 'Rental history', 'Student ratings', 'Dispute support'].map(point => (
                  <span key={point}><ShieldCheck size={13} strokeWidth={2} /> {point}</span>
                ))}
              </div>
            </div>
          </section>

          {/* Community */}
          <section className="info-section community-section" id="about">
            <div className="container">
              <div className="section-heading centered-heading">
                <span className="eyebrow">A safer campus marketplace</span>
                <h2>Built for a Trusted Campus Community</h2>
              </div>
              <div className="community-points">
                {['Verified student accounts', 'Student ratings', 'Rental history', 'Secure payments', 'Refundable deposits', 'Verified handovers', 'Dispute support'].map(point => (
                  <span key={point}><ShieldCheck size={12} strokeWidth={2} /> {point}</span>
                ))}
              </div>
            </div>
          </section>

          {/* Popular Categories */}
          <section className="info-section popular-section">
            <div className="container">
              <div className="section-heading">
                <span className="eyebrow">Start exploring</span>
                <h2>Popular Categories</h2>
              </div>
              <div className="popular-categories">
                {['Books', 'Calculators', 'Electronics', 'Lab Equipment', 'Sports Equipment', 'Stationery', 'Tools', 'Clothing', 'Hostel Essentials', 'Study Materials'].map(cat => (
                  <button key={cat} onClick={scrollToMarketplace}>
                    {cat} <ChevronRight size={12} strokeWidth={2} />
                  </button>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ════════════════════════════════════════
          MARKETPLACE SECTION
          ════════════════════════════════════════ */}
      {marketplaceOnly && (
        <section className="marketplace-section container" id="marketplace">
          <div className="home-header">
            <span className="eyebrow">From verified student listings</span>
            <h2>Things Students Are Sharing</h2>
            <p>Browse real listings from the CampusMesh marketplace.</p>
          </div>

          {/* Filters */}
          <div className="search-filter-container">
            {/* Mode toggles */}
            <div className="mode-toggle-bar">
              <span className="mode-toggle-label">Browse by:</span>
              <button
                type="button"
                className={`mode-toggle-btn${deliveryModeOnly ? ' active' : ''}`}
                onClick={() => setDeliveryModeOnly(p => !p)}
              >
                <Truck size={13} strokeWidth={1.75} />
                <span>Delivery</span>
                {deliveryModeOnly && <span className="mode-status-badge">ON</span>}
              </button>
              <button
                type="button"
                className={`mode-toggle-btn${rentalModeOnly ? ' active' : ''}`}
                onClick={() => setRentalModeOnly(p => !p)}
              >
                <RefreshCw size={13} strokeWidth={1.75} />
                <span>Rentals</span>
                {rentalModeOnly && <span className="mode-status-badge">ON</span>}
              </button>
              {(deliveryModeOnly || rentalModeOnly) && (
                <button
                  type="button"
                  className="mode-clear-btn"
                  onClick={() => { setDeliveryModeOnly(false); setRentalModeOnly(false); }}
                >
                  <X size={12} strokeWidth={2} /> Reset
                </button>
              )}
            </div>

            {/* Search + filters row */}
            <div className="filter-row-top">
              {/* Search */}
              <div className="search-bar">
                <Search size={15} strokeWidth={1.75} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by title, author, brand..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              {/* Price */}
              <div className="filter-group">
                <label>Price Range (₹)</label>
                <div className="price-inputs-row">
                  <input type="number" placeholder="Min" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="price-input-box" min="0" />
                  <span className="price-divider">–</span>
                  <input type="number" placeholder="Max" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="price-input-box" min="0" />
                </div>
              </div>

              {/* Condition & Sort */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="filter-group">
                  <label>Condition</label>
                  <select value={selectedCondition} onChange={e => setSelectedCondition(e.target.value)} className="form-input" style={{ height: '36px', fontSize: '13px' }}>
                    <option value="All">All</option>
                    <option value="New">New</option>
                    <option value="Like New">Like New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Sort By</label>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="form-input" style={{ height: '36px', fontSize: '13px' }}>
                    <option value="newest">Newest</option>
                    <option value="price_asc">Price: Low–High</option>
                    <option value="price_desc">Price: High–Low</option>
                    <option value="closest">Closest</option>
                    <option value="rating_desc">Rating</option>
                    <option value="mesh_desc">Mesh Score</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Category pills */}
            <div className="category-pills-container">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`category-pill${selectedCategory === cat ? ' active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Listings grid */}
          {loading ? (
            <MarketplaceSkeleton count={8} />
          ) : displayedListings.length === 0 ? (
            <div className="empty-state">
              <Package size={36} strokeWidth={1} style={{ color: 'var(--color-text-subtle)', margin: '0 auto 1rem' }} />
              <h3>No listings found</h3>
              <p>
                {selectedCategory === 'Saved'
                  ? "You haven't saved any listings yet. Tap the heart icon on items to save them."
                  : 'Try clearing your search or adjusting the filters.'}
              </p>
              {(searchQuery || selectedCategory !== 'All') && (
                <button className="btn btn-outline btn-sm" style={{ marginTop: '1rem' }} onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}>
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="marketplace-grid">
                {displayedListings.map(prod => {
                  const seller   = getSeller(prod);
                  const initials = seller.name ? seller.name.charAt(0).toUpperCase() : 'U';
                  const isFav    = favorites.includes(prod.id);

                  return (
                    <div key={prod.id} className="product-card">
                      {/* Image */}
                      <div className="product-image-container">
                        <img src={prod.image_url} alt={prod.title} className="product-image" loading="lazy" />

                        {/* Badges */}
                        <div className="card-top-badges">
                          <span className="badge badge-condition">{prod.condition}</span>
                          {prod.deliveryAvailable && (
                            <span className="badge badge-rent" style={{ gap: '3px' }}>
                              <Truck size={10} strokeWidth={2} /> Delivery
                            </span>
                          )}
                        </div>

                        {/* Heart + Share */}
                        <div className="card-top-actions">
                          <button
                            className={`action-btn-circle${isFav ? ' is-fav' : ''}`}
                            onClick={() => toggleFavorite(prod.id)}
                            title={isFav ? 'Remove from Saved' : 'Save Item'}
                            aria-label={isFav ? 'Remove from saved' : 'Save item'}
                          >
                            <Heart size={14} strokeWidth={2} fill={isFav ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            className="action-btn-circle"
                            onClick={() => handleShare(prod)}
                            title="Copy link"
                            aria-label="Share listing"
                          >
                            <Share2 size={14} strokeWidth={2} />
                          </button>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="product-card-body">
                        <div className="card-category-row">
                          <span className="card-category-lbl">{prod.category}</span>
                        </div>

                        <h3>{prod.title}</h3>
                        <p className="card-desc">{prod.description}</p>

                        {/* Rent/Borrow badges */}
                        <div className="card-availability-badges">
                          {prod.rentPrice > 0 && (
                            <span className="badge badge-rent">RENT · ₹{prod.rentPrice}/day</span>
                          )}
                          <span className="badge badge-borrow">BORROW</span>
                        </div>

                        {/* Deposit */}
                        <div className="prices-matrix">
                          <div className="price-item">
                            <span>Deposit</span>
                            <strong>₹{prod.deposit}</strong>
                          </div>
                          <div className="price-item">
                            <span>Rent/day</span>
                            <strong className="rent-rate">₹{prod.rentPrice}</strong>
                          </div>
                        </div>

                        {/* Location */}
                        <div className="card-location-row">
                          <span className="location-pin">
                            <MapPin size={12} strokeWidth={1.75} /> {prod.location}
                          </span>
                          <span className="walk-dist">
                            <Clock size={12} strokeWidth={1.75} /> {prod.pickupTime}
                          </span>
                        </div>

                        {/* Seller */}
                        <div className="seller-badge-bar">
                          <div className="seller-avatar-mini" title={seller.name}>{initials}</div>
                          <div className="seller-details-mini">
                            <span className="seller-name-mini">{seller.name}</span>
                            <span className="seller-rating-mini">
                              {seller.rating
                                ? <><Star size={11} strokeWidth={2} fill="currentColor" style={{ color: '#F59E0B' }} /> {seller.rating}</>
                                : <><ShieldCheck size={11} strokeWidth={2} /> Verified student</>}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="card-action-buttons">
                          {user ? (
                            prod.isDbListing && prod.owner_id === user.id ? (
                              <div className="your-listing-badge">Your Active Listing</div>
                            ) : (
                              <>
                                <Link to={`/item/${prod.id}`} className="btn btn-primary btn-sm btn-card">
                                  Rent Now
                                </Link>
                                <Link
                                  to={`/chat?sellerId=${prod.sellerId}&sellerName=${encodeURIComponent(seller.name)}&listingTitle=${encodeURIComponent(prod.title)}`}
                                  className="btn btn-outline btn-sm btn-card"
                                >
                                  Borrow
                                </Link>
                              </>
                            )
                          ) : (
                            <button onClick={() => navigate('/login')} className="btn btn-outline btn-sm" style={{ gridColumn: 'span 2', width: '100%' }}>
                              Login to Rent / Borrow
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load more / pagination */}
              {totalPages > 1 && (
                <div className="pagination-controls">
                  {displayedListings.length < totalItems && (
                    <button onClick={handleLoadMore} className="btn btn-outline" style={{ marginBottom: '1rem' }}>
                      Load More Listings
                    </button>
                  )}
                  <div className="pagination-pages">
                    <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}>←</button>
                    {[...Array(totalPages)].map((_, i) => (
                      <button key={i} className={`page-btn${currentPage === i + 1 ? ' active' : ''}`} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
                    ))}
                    <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}>→</button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ════════════════════════════════════════
          FOOTER CTA (public only)
          ════════════════════════════════════════ */}
      {!marketplaceOnly && (
        <>
          <section className="final-cta">
            <div className="container final-cta-inner">
              <div>
                <span className="eyebrow">Ready when you are</span>
                <h2>Ready to Rent, Borrow or Share?</h2>
                <p>Join your campus community and make useful things easier to access.</p>
                <Link to="/signup" className="btn btn-primary">Get Started <ArrowRight size={14} strokeWidth={2} /></Link>
              </div>
              <div>
                <span className="eyebrow">Already a member?</span>
                <h2>Use CampusMesh today.</h2>
                <p>Log in to browse listings, manage rentals, and share your items.</p>
                <Link to="/login" className="btn btn-outline">Sign In</Link>
              </div>
            </div>
          </section>

          <footer className="campus-footer">
            <div className="container footer-inner">
              <div>
                <Link to="/" className="footer-logo">Campus<span>Mesh</span></Link>
                <p>Rent less. Share more. Save together.</p>
              </div>
              <div className="footer-links">
                <Link to="/marketplace">Marketplace</Link>
                <a href="#how-it-works">How It Works</a>
                <Link to="/signup">Create Account</Link>
                <a href="#safety">Safety</a>
                <a href="mailto:support@campusmesh.local">Help</a>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
};

export default Home;
