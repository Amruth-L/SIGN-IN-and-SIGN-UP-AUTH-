import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { user, api, logout } = useAuth();
  const navigate = useNavigate();
  const [myListings, setMyListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // If not logged in, wait or redirect (handled in PrivateRoute normally)
    if (!user) return;

    const fetchMyListings = async () => {
      try {
        const res = await api.get('/listings');
        // Filter listings that belong to the logged in user
        const mine = res.data.filter(listing => listing.owner_id === user.id);
        setMyListings(mine);
      } catch (err) {
        setError('Failed to fetch your listings');
      } finally {
        setLoading(false);
      }
    };

    fetchMyListings();
  }, [user, api]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this listing?')) {
      try {
        await api.delete(`/listings/${id}`);
        setMyListings(myListings.filter(listing => listing.id !== id));
      } catch (err) {
        alert('Failed to delete listing');
      }
    }
  };

  if (!user) return <div className="container" style={{ paddingTop: '2rem' }}>Please log in...</div>;

  return (
    <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>My Profile</h1>
          <p className="text-muted">{user.email}</p>
        </div>
        <button onClick={logout} className="btn btn-danger">Logout</button>
      </div>

      <div className="card" style={{ padding: '2rem', marginBottom: '3rem' }}>
        <h3>Account Details</h3>
        <p style={{ marginTop: '1rem' }}><strong>Name:</strong> {user.name}</p>
        <p><strong>Email:</strong> {user.email}</p>
      </div>

      <h2>My Active Listings</h2>
      {error && <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>}
      
      {loading ? (
        <div className="loading" style={{ marginTop: '1rem' }}>Loading...</div>
      ) : myListings.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '1rem' }}>
          <p>You haven't posted any listings yet.</p>
          <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => navigate('/add-listing')}>
            Create a Listing
          </button>
        </div>
      ) : (
        <div className="listings-grid" style={{ marginTop: '2rem' }}>
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
                  <button onClick={() => handleDelete(listing.id)} className="btn btn-danger" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Profile;
