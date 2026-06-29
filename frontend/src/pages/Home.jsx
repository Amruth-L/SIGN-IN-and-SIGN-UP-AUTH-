import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const { api, user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

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

      {loading ? (
        <div className="loading">Loading listings...</div>
      ) : listings.length === 0 ? (
        <div className="empty-state">
          <p>No listings found. Be the first to post something!</p>
        </div>
      ) : (
        <div className="listings-grid">
          {listings.map(listing => (
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
