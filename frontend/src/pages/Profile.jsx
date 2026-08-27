import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Star, X, CheckCircle2 } from 'lucide-react';
import './Profile.css';

const Profile = ({ defaultTab = 'listings' }) => {
  const { user, api, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [myListings, setMyListings] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listingsError, setListingsError] = useState('');
  
  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedRentalForReview, setSelectedRentalForReview] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState('');
  const [submittedReviews, setSubmittedReviews] = useState({});

  const reviewComplimentTags = [
    'Item as described',
    'Great condition',
    'Friendly owner',
    'Smooth handover',
    'Fast response',
    'Highly recommended'
  ];

  const ratingDescriptions = {
    1: 'Disappointing',
    2: 'Below Average',
    3: 'Good & Functional',
    4: 'Very Good Experience',
    5: 'Outstanding / Perfect'
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('campusmesh_rental_reviews') || '{}');
      setSubmittedReviews(saved);
    } catch {
      // ignore
    }
  }, []);

  const handleOpenReviewModal = (rental) => {
    const rentalKey = rental.id || rental.listing_id || rental.listingId || `rent-${rental.startDate || rental.start_date}`;
    setSelectedRentalForReview(rental);
    const existing = submittedReviews[rentalKey];
    if (existing) {
      setReviewRating(existing.rating || 5);
      setReviewComment(existing.comment || '');
      setSelectedTags(existing.tags || []);
    } else {
      setReviewRating(5);
      setReviewComment('');
      setSelectedTags([]);
    }
    setReviewSuccessMsg('');
    setReviewModalOpen(true);
  };

  const handleToggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmitReview = (e) => {
    e.preventDefault();
    if (!selectedRentalForReview) return;
    setSubmittingReview(true);

    const rentalKey = selectedRentalForReview.id || selectedRentalForReview.listing_id || selectedRentalForReview.listingId || `rent-${selectedRentalForReview.startDate || selectedRentalForReview.start_date}`;
    const reviewData = {
      rentalKey,
      listingTitle: selectedRentalForReview.listing_title || selectedRentalForReview.listingTitle || 'Rental Item',
      ownerName: selectedRentalForReview.owner_name || 'Owner',
      rating: reviewRating,
      comment: reviewComment,
      tags: selectedTags,
      reviewedAt: new Date().toISOString()
    };

    setTimeout(() => {
      const updated = {
        ...submittedReviews,
        [rentalKey]: reviewData
      };
      setSubmittedReviews(updated);
      localStorage.setItem('campusmesh_rental_reviews', JSON.stringify(updated));
      setSubmittingReview(false);
      setReviewSuccessMsg('Review submitted successfully!');
      setTimeout(() => {
        setReviewModalOpen(false);
        setReviewSuccessMsg('');
      }, 1200);
    }, 500);
  };
  
  // Settings Form State
  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
    phone_number: user?.phone_number || '',
    avatar_url: user?.avatar_url || '',
    bio: user?.bio || '',
    department: user?.department || '',
    hostel: user?.hostel || '',
    old_password: '',
    new_password: ''
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  // Sync defaultTab if it changes from router
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (!user) return;
    setFormData({
      name: user.name || '',
      username: user.username || '',
      email: user.email || '',
      phone_number: user.phone_number || '',
      avatar_url: user.avatar_url || '',
      bio: user.bio || '',
      department: user.department || '',
      hostel: user.hostel || '',
      old_password: '',
      new_password: ''
    });

    const fetchProfileData = async () => {
      try {
        setLoading(true);
        setListingsError('');

        // 1. Fetch user's listings
        const listingsRes = await api.get('/listings');
        const mine = listingsRes.data.filter(listing => listing.owner_id === user.id);
        setMyListings(mine);

        // 2. Fetch My Rentals from Database API
        try {
          const rentalsRes = await api.get('/api/rentals/my-rentals');
          setRentals(rentalsRes.data);
        } catch (rentErr) {
          console.error('[Profile] Failed to fetch database rentals:', rentErr);
          setRentals([]);
        }

        // 3. Fetch Saved Items (Wishlist) from Database API
        try {
          const wishlistRes = await api.get('/api/wishlist');
          setSavedItems(wishlistRes.data);
          const savedIds = wishlistRes.data.map(item => item.id);
          localStorage.setItem('campusmesh_favorites', JSON.stringify(savedIds));
        } catch (wishErr) {
          console.error('[Profile] Failed to fetch database wishlist, using localStorage fallback:', wishErr);
          const savedIds = JSON.parse(localStorage.getItem('campusmesh_favorites') || '[]');
          const saved = (listingsRes?.data || []).filter(listing => savedIds.includes(listing.id));
          setSavedItems(saved);
        }

      } catch (err) {
        setListingsError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user, api]);

  const handleDeleteListing = async (id) => {
    if (window.confirm('Are you sure you want to delete this listing?')) {
      try {
        await api.delete(`/listings/${id}`);
        setMyListings(myListings.filter(listing => listing.id !== id));
      } catch (err) {
        alert('Failed to delete listing');
      }
    }
  };

  const handleRemoveSaved = async (itemId) => {
    try {
      await api.delete(`/api/wishlist/${itemId}`);
      setSavedItems(prev => prev.filter(item => item.id !== itemId && item.wishlist_id !== itemId));
    } catch (err) {
      console.error('Error removing saved item:', err);
      setSavedItems(prev => prev.filter(item => item.id !== itemId && item.wishlist_id !== itemId));
    } finally {
      const savedIds = JSON.parse(localStorage.getItem('campusmesh_favorites') || '[]');
      const updated = savedIds.filter(id => id !== itemId);
      localStorage.setItem('campusmesh_favorites', JSON.stringify(updated));
    }
  };

  // Helper for Status Badge Label
  const getStatusBadge = (status) => {
    switch (status) {
      case 'BOOKING_REQUESTED':
      case 'OWNER_PENDING':
        return { label: 'Requested', className: 'status-requested', bg: '#eff6ff', color: '#1d4ed8' };
      case 'DEPOSIT_PENDING':
        return { label: 'Accepted', className: 'status-accepted', bg: '#fef3c7', color: '#b45309' };
      case 'QR_GENERATED':
      case 'HANDOVER':
        return { label: 'Delivered', className: 'status-delivered', bg: '#e0e7ff', color: '#4338ca' };
      case 'ACTIVE':
      case 'RENTAL_PAYMENT_COMPLETED':
        return { label: 'Active', className: 'status-active', bg: '#dcfce7', color: '#15803d' };
      case 'OWNER_INSPECTION':
        return { label: 'Returned', className: 'status-returned', bg: '#f3e8ff', color: '#6b21a8' };
      case 'COMPLETED':
      case 'DEPOSIT_REFUNDED':
        return { label: 'Completed', className: 'status-completed', bg: '#f3f4f6', color: '#374151' };
      case 'CANCELLED':
        return { label: 'Cancelled', className: 'status-cancelled', bg: '#fee2e2', color: '#b91c1c' };
      default:
        return { label: status || 'Active', className: 'status-active', bg: '#dcfce7', color: '#15803d' };
    }
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSettingsSuccess(false);
    setSettingsError('');
    
    if (!formData.name.trim()) {
      setSettingsError('Name cannot be empty.');
      return;
    }

    setSettingsLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        username: formData.username.trim(),
        email: formData.email.trim(),
        phone_number: formData.phone_number.trim(),
        avatar_url: formData.avatar_url.trim(),
        bio: formData.bio ? formData.bio.trim() : null,
        department: formData.department.trim(),
        hostel: formData.hostel ? formData.hostel.trim() : null,
      };

      if (formData.new_password) {
        payload.old_password = formData.old_password;
        payload.new_password = formData.new_password;
      }

      await updateProfile(payload);
      setSettingsSuccess(true);
      setFormData(prev => ({ ...prev, old_password: '', new_password: '' }));
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      setSettingsError(err.response?.data?.error || err.response?.data?.message || 'Failed to update profile settings.');
    } finally {
      setSettingsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
        <p className="text-muted">Please log in to view this page.</p>
        <button onClick={() => navigate('/login')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Go to Login
        </button>
      </div>
    );
  }

  const initials = user.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <div className="profile-container">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar-large">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            initials
          )}
        </div>
        <div className="profile-info">
          <h1>{user.name}</h1>
          <p className="profile-email">
            <span>📧</span> {user.email}
          </p>
          <span className="profile-meta-badge">Student Member</span>
        </div>
        <div>
          <button onClick={logout} className="btn btn-danger">Logout</button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="profile-tabs-nav">
        <button 
          onClick={() => setActiveTab('listings')} 
          className={`profile-tab-btn ${activeTab === 'listings' ? 'active' : ''}`}
        >
          My Listings ({myListings.length})
        </button>
        <button 
          onClick={() => setActiveTab('rentals')} 
          className={`profile-tab-btn ${activeTab === 'rentals' ? 'active' : ''}`}
        >
          My Rentals ({rentals.length})
        </button>
        <button 
          onClick={() => setActiveTab('saved')} 
          className={`profile-tab-btn ${activeTab === 'saved' ? 'active' : ''}`}
        >
          Saved Items ({savedItems.length})
        </button>
        <button 
          onClick={() => setActiveTab('settings')} 
          className={`profile-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
        >
          Settings
        </button>
      </div>

      {/* Tab Contents Area */}
      <div className="tab-content-area">
        
        {/* Listings Tab */}
        {activeTab === 'listings' && (
          <div>
            {listingsError && <div className="error-message">{listingsError}</div>}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-dark)' }}>My Listed Items</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Manage items you are selling or renting out</p>
              </div>
              {myListings.length > 0 && (
                <button 
                  className="btn btn-primary" 
                  onClick={() => navigate('/create-listing')}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  + List New Item
                </button>
              )}
            </div>

            {loading ? (
              <div className="loading">Loading your listings...</div>
            ) : myListings.length === 0 ? (
              <div className="empty-state">
                <p>You haven't posted any listings yet.</p>
                <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/create-listing')}>
                  Create a Listing
                </button>
              </div>
            ) : (
              <div className="listings-grid">
                {myListings.map(listing => (
                  <div key={listing.id} className="card listing-card">
                    <div className="listing-img-placeholder">
                      {listing.image_url ? (
                        <img src={listing.image_url} alt={listing.title} loading="lazy" />
                      ) : (
                        <span>No Image</span>
                      )}
                    </div>
                    <div className="listing-content">
                      <span className="listing-category">{listing.category}</span>
                      <h3>{listing.title}</h3>
                      <p className="listing-price">₹{listing.price}</p>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button 
                          onClick={() => navigate(`/edit-listing/${listing.id}`)} 
                          className="btn btn-outline" 
                          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteListing(listing.id)} 
                          className="btn btn-danger" 
                          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rentals Tab */}
        {activeTab === 'rentals' && (
          <div>
            {loading ? (
              <div className="loading">Loading your rentals...</div>
            ) : rentals.length === 0 ? (
              <div className="empty-state">
                <p>You haven't rented any items yet.</p>
                <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => navigate('/marketplace')}>
                  Browse Marketplace
                </button>
              </div>
            ) : (
              <div className="rentals-list">
                {rentals.map((rental, index) => {
                  const badge = getStatusBadge(rental.status);
                  const img = rental.listing_image || rental.listingImage || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500&auto=format&fit=crop&q=60';
                  const title = rental.listing_title || rental.listingTitle || 'Rental Item';
                  const owner = rental.owner_name || 'Item Owner';

                  return (
                    <div key={rental.id || index} className="rental-item-card">
                      <div className="rental-img">
                        <img src={img} alt={title} loading="lazy" />
                      </div>
                      <div className="rental-details">
                        <div className="rental-meta">
                          <div className="rental-meta-info">
                            <h3>{title}</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Owner: <strong>{owner}</strong>
                            </p>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                            <span className={`rental-status ${badge.className}`} style={{ background: badge.bg, color: badge.color }}>
                              {badge.label}
                            </span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                              Payment: {rental.payment_status || 'PAID'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="rental-info-grid">
                          <div className="rental-info-block">
                            <span>Rental Dates</span>
                            <strong>{new Date(rental.start_date || rental.startDate).toLocaleDateString()} - {new Date(rental.end_date || rental.endDate).toLocaleDateString()}</strong>
                          </div>
                          <div className="rental-info-block">
                            <span>Return Date</span>
                            <strong>{new Date(rental.end_date || rental.endDate).toLocaleDateString()}</strong>
                          </div>
                          <div className="rental-info-block">
                            <span>Duration</span>
                            <strong>{rental.rental_days || rental.totalDays || 1} Days</strong>
                          </div>
                          <div className="rental-info-block">
                            <span>Booking Fee</span>
                            <strong>₹{rental.booking_amount || rental.totalPrice || rental.rental_fee}</strong>
                          </div>
                        </div>

                        <div className="rental-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                          <button 
                            onClick={() => navigate(`/rent-details/${rental.id}`)}
                            className="btn btn-primary"
                            style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
                          >
                            Track Order
                          </button>
                          {(() => {
                            const rentalKey = rental.id || rental.listing_id || rental.listingId || `rent-${rental.startDate || rental.start_date}`;
                            const isReviewed = !!submittedReviews[rentalKey];
                            return (
                              <button 
                                onClick={() => handleOpenReviewModal(rental)}
                                className="btn btn-outline"
                                style={{ 
                                  padding: '0.5rem 1.25rem', 
                                  fontSize: '0.875rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  borderColor: isReviewed ? '#eab308' : '#22c55e',
                                  color: isReviewed ? '#ca8a04' : '#16a34a'
                                }}
                              >
                                <Star size={14} fill={isReviewed ? '#eab308' : 'none'} color={isReviewed ? '#eab308' : 'currentColor'} />
                                {isReviewed ? `Reviewed (${submittedReviews[rentalKey].rating}★)` : 'Leave Review'}
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Saved Items Tab (ISSUE 5 ALIGNMENT FIX) */}
        {activeTab === 'saved' && (
          <div>
            {loading ? (
              <div className="loading">Loading saved items...</div>
            ) : savedItems.length === 0 ? (
              <div className="empty-state">
                <p>You haven't saved any listings yet.</p>
                <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => navigate('/marketplace')}>
                  Browse Items
                </button>
              </div>
            ) : (
              <div className="saved-items-grid" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {savedItems.map(listing => (
                  <div key={listing.id} className="saved-item-card" style={{
                    display: 'flex',
                    background: 'var(--surface-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    alignItems: 'center',
                    padding: '16px',
                    gap: '20px'
                  }}>
                    {/* Image Left */}
                    <div style={{ width: '140px', height: '140px', minWidth: '140px', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#f3f4f6' }}>
                      {listing.image_url ? (
                        <img src={listing.image_url} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: '0.85rem' }}>No Image</div>
                      )}
                    </div>

                    {/* Details Right */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="listing-category" style={{ fontSize: '0.75rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '2px 8px', borderRadius: '99px', fontWeight: 600 }}>
                            {listing.category}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📍 {listing.location || 'Campus'}</span>
                        </div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-dark)', margin: '4px 0' }}>{listing.title}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 8px 0', lineClamp: 2, WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {listing.description}
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                        <div>
                          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>₹{listing.rent_price || listing.price}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}> / day</span>
                        </div>

                        {/* Buttons Bottom */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button 
                            onClick={() => navigate(`/item/${listing.id}`)} 
                            className="btn btn-primary" 
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                          >
                            Rent Now
                          </button>
                          <button 
                            onClick={() => handleRemoveSaved(listing.id)} 
                            className="btn btn-outline" 
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#ef4444', borderColor: '#fecaca' }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="settings-grid">
            <div className="settings-card">
              <h3>Account Settings</h3>
              
              {settingsSuccess && (
                <div className="success-banner">
                  ✨ Profile updated successfully!
                </div>
              )}
              
              {settingsError && (
                <div className="error-message">
                  {settingsError}
                </div>
              )}
              
              <form onSubmit={handleSettingsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">DBIT Email</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formData.phone_number}
                      onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Profile Avatar URL</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="https://api.dicebear.com/..."
                    value={formData.avatar_url}
                    onChange={(e) => setFormData({...formData, avatar_url: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Short Bio</label>
                  <textarea 
                    className="form-input" 
                    style={{ height: '80px', resize: 'vertical' }}
                    value={formData.bio || ''}
                    onChange={(e) => setFormData({...formData, bio: e.target.value})}
                    maxLength={300}
                    placeholder="Tell other students about yourself..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Computer Science"
                      value={formData.department}
                      onChange={(e) => setFormData({...formData, department: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hostel Block / Location</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Boys Hostel A"
                      value={formData.hostel}
                      onChange={(e) => setFormData({...formData, hostel: e.target.value})}
                    />
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '1rem 0' }} />
                
                <h4 style={{ color: '#1f2937', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Change Password</h4>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>Leave these blank if you do not want to change your password.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      placeholder="••••••••"
                      value={formData.old_password}
                      onChange={(e) => setFormData({...formData, old_password: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      placeholder="••••••••"
                      value={formData.new_password}
                      onChange={(e) => setFormData({...formData, new_password: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '1.5rem' }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={settingsLoading}
                    style={{ backgroundColor: '#22c55e', borderColor: '#22c55e' }}
                  >
                    {settingsLoading ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* Review Modal */}
      {reviewModalOpen && selectedRentalForReview && (
        <div className="review-modal-backdrop" onClick={() => !submittingReview && setReviewModalOpen(false)}>
          <div className="review-modal-card" onClick={e => e.stopPropagation()}>
            <div className="review-modal-header">
              <h3>Leave a Review</h3>
              <button 
                className="review-modal-close-btn" 
                onClick={() => setReviewModalOpen(false)}
                disabled={submittingReview}
              >
                <X size={18} />
              </button>
            </div>

            <div className="review-modal-body">
              {/* Item Info */}
              <div className="review-item-preview">
                <img 
                  src={selectedRentalForReview.listing_image || selectedRentalForReview.listingImage || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500&auto=format&fit=crop&q=60'} 
                  alt={selectedRentalForReview.listing_title || selectedRentalForReview.listingTitle} 
                />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                    {selectedRentalForReview.listing_title || selectedRentalForReview.listingTitle || 'Rental Item'}
                  </h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Owner: {selectedRentalForReview.owner_name || 'Item Owner'}
                  </p>
                </div>
              </div>

              {reviewSuccessMsg ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <CheckCircle2 size={48} style={{ color: '#22c55e', margin: '0 auto 10px auto' }} />
                  <h4 style={{ margin: 0, color: 'var(--text-dark)' }}>{reviewSuccessMsg}</h4>
                </div>
              ) : (
                <form onSubmit={handleSubmitReview}>
                  {/* Star Rating */}
                  <div className="review-stars-container">
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      Rate your overall rental experience
                    </span>
                    <div className="review-stars-row">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className="review-star-btn"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setReviewRating(star)}
                        >
                          <Star 
                            size={28} 
                            fill={(hoverRating || reviewRating) >= star ? '#f59e0b' : 'none'} 
                            color={(hoverRating || reviewRating) >= star ? '#f59e0b' : 'var(--text-muted)'} 
                          />
                        </button>
                      ))}
                    </div>
                    <span className="review-rating-label">
                      {ratingDescriptions[hoverRating || reviewRating]}
                    </span>
                  </div>

                  {/* Compliment Chips */}
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Highlight positive aspects
                    </label>
                    <div className="review-tags-grid">
                      {reviewComplimentTags.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleToggleTag(tag)}
                          className={`review-tag-chip ${selectedTags.includes(tag) ? 'active' : ''}`}
                        >
                          {selectedTags.includes(tag) ? '✓ ' : '+ '}{tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feedback Comments */}
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Detailed Feedback (Optional)
                    </label>
                    <textarea
                      className="review-textarea"
                      placeholder="How was the item quality? Was the owner helpful with pickup and return?"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Actions */}
                  <div className="review-modal-actions">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setReviewModalOpen(false)}
                      disabled={submittingReview}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ backgroundColor: '#22c55e', borderColor: '#22c55e', color: '#fff' }}
                      disabled={submittingReview}
                    >
                      {submittingReview ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
