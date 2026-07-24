import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
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
  
  // Settings Form State
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  // Sync defaultTab if it changes from router
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (!user) return;
    setNameInput(user.name || '');

    const fetchProfileData = async () => {
      try {
        setLoading(true);
        // Fetch all listings to filter my listings and saved items
        const res = await api.get('/listings');
        const allListings = res.data;

        // Filter user's listings
        const mine = allListings.filter(listing => listing.owner_id === user.id);
        setMyListings(mine);

        // Fetch Saved Items from localStorage
        const savedIds = JSON.parse(localStorage.getItem('campusmesh_favorites') || '[]');
        const saved = allListings.filter(listing => savedIds.includes(listing.id));
        setSavedItems(saved);

        // Fetch Rentals from localStorage
        const rentedList = JSON.parse(localStorage.getItem('campusmesh_rentals') || '[]');
        // Filter out rentals belonging to this user
        const userRentals = rentedList.filter(rental => rental.renterId === user.id);
        setRentals(userRentals);

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

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSettingsSuccess(false);
    setSettingsError('');
    
    if (!nameInput.trim()) {
      setSettingsError('Name cannot be empty');
      return;
    }

    setSettingsLoading(true);
    try {
      await updateProfile(nameInput.trim());
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      setSettingsError(err.response?.data?.error || 'Failed to update profile settings');
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
          {initials}
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
            
            {loading ? (
              <div className="loading">Loading your listings...</div>
            ) : myListings.length === 0 ? (
              <div className="empty-state">
                <p>You haven't posted any listings yet.</p>
                <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => navigate('/add-listing')}>
                  Create a Listing
                </button>
              </div>
            ) : (
              <div className="listings-grid">
                {myListings.map(listing => (
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
                <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => navigate('/')}>
                  Browse Marketplace
                </button>
              </div>
            ) : (
              <div className="rentals-list">
                {rentals.map((rental, index) => (
                  <div key={index} className="rental-item-card">
                    <div className="rental-img">
                      {rental.listingImage ? (
                        <img src={rental.listingImage} alt={rental.listingTitle} />
                      ) : (
                        <span>No Image</span>
                      )}
                    </div>
                    <div className="rental-details">
                      <div className="rental-meta">
                        <div className="rental-meta-info">
                          <h3>{rental.listingTitle}</h3>
                          <span className="listing-category" style={{ marginTop: '0.5rem' }}>{rental.listingCategory}</span>
                        </div>
                        <span className="rental-status active">Active Rental</span>
                      </div>
                      
                      <div className="rental-info-grid">
                        <div className="rental-info-block">
                          <span>Start Date</span>
                          <strong>{new Date(rental.startDate).toLocaleDateString()}</strong>
                        </div>
                        <div className="rental-info-block">
                          <span>End Date</span>
                          <strong>{new Date(rental.endDate).toLocaleDateString()}</strong>
                        </div>
                        <div className="rental-info-block">
                          <span>Total Days</span>
                          <strong>{rental.totalDays} Days</strong>
                        </div>
                        <div className="rental-info-block">
                          <span>Total Price Paid</span>
                          <strong>₹{rental.totalPrice}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Saved Items Tab */}
        {activeTab === 'saved' && (
          <div>
            {loading ? (
              <div className="loading">Loading saved items...</div>
            ) : savedItems.length === 0 ? (
              <div className="empty-state">
                <p>You haven't saved any listings yet.</p>
                <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => navigate('/')}>
                  Browse Items
                </button>
              </div>
            ) : (
              <div className="listings-grid">
                {savedItems.map(listing => (
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
                      <button 
                        onClick={() => navigate('/')} 
                        className="btn btn-primary" 
                        style={{ width: '100%', marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                      >
                        View Details
                      </button>
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
              
              <form onSubmit={handleSettingsSubmit}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Email Address (Read-Only)</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    value={user.email} 
                    disabled 
                    style={{ backgroundColor: 'rgba(0,0,0,0.05)', cursor: 'not-allowed' }}
                  />
                </div>

                <div className="form-group" style={{ marginTop: '2rem' }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={settingsLoading}
                  >
                    {settingsLoading ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Profile;
