import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { mockProducts, mockSellers } from '../data/mockData';
import './RentItem.css';

const RentItem = () => {
  const { id } = useParams();
  const { api, user } = useAuth();
  const navigate = useNavigate();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Date Fields
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalDays, setTotalDays] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [rentSuccess, setRentSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Set min date of start date to today
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchListingDetails = async () => {
      console.log(`[Frontend Debug] useParams() received ID: "${id}"`);
      if (!id) {
        setError('Listing ID is missing in request parameters.');
        setLoading(false);
        return;
      }

      // Check if it's a mock product
      if (id.startsWith('mp-')) {
        console.log(`[Frontend Debug] ID "${id}" detected as mock product. Fetching locally.`);
        const mockProduct = mockProducts.find(p => p.id === id);
        if (mockProduct) {
          console.log(`[Frontend Debug] Found mock product locally:`, mockProduct);
          // Find mock seller details
          const mockSeller = mockSellers.find(s => s.id === mockProduct.sellerId);
          const enrichedListing = {
            ...mockProduct,
            owner_name: mockSeller ? mockSeller.name : 'Student Seller',
            owner_email: mockSeller ? mockSeller.email : 'student@campushmesh.com'
          };
          setListing(enrichedListing);
        } else {
          console.error(`[Frontend Debug] Mock product "${id}" not found in mockData.`);
          setError('Mock listing not found.');
        }
        setLoading(false);
        return;
      }

      // Query database from backend
      try {
        const url = `/listings/${id}`;
        console.log(`[Frontend Debug] Fetching database listing from backend API URL: "${url}"`);
        const token = localStorage.getItem('token');
        console.log(`[Frontend Debug] Authorization Header present:`, !!token);
        
        const res = await api.get(url);
        console.log(`[Frontend Debug] Backend API response received:`, res.data);
        setListing(res.data);
      } catch (err) {
        console.error(`[Frontend Debug] API Fetch failed:`, err);
        if (err.response) {
          const status = err.response.status;
          const serverError = err.response.data?.error;
          if (status === 400) {
            setError(`Invalid listing ID: ${serverError || 'Format error'}`);
          } else if (status === 404) {
            setError(`Listing not found: ${serverError || 'The listing might have been removed'}`);
          } else if (status === 401 || status === 403) {
            setError(`Unauthorized: Please log in again`);
          } else {
            setError(`Server database error (${status}): ${serverError || 'Failed to retrieve details'}`);
          }
        } else {
          setError(`Network error: Could not reach backend server.`);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchListingDetails();
  }, [id, api]);

  // Calculate days & price when dates change
  useEffect(() => {
    if (!startDate || !endDate || !listing) {
      setTotalDays(0);
      setTotalPrice(0);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      setTotalDays(0);
      setTotalPrice(0);
      return;
    }

    // Difference in milliseconds
    const diffTime = Math.abs(end - start);
    // Convert to days (include both days, so add 1)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    setTotalDays(diffDays);
    
    // Rent price calculation: supports rent_price or rentPrice, falling back to price
    const dailyPrice = parseFloat(listing.rent_price || listing.rentPrice || listing.price || 0);
    let calculatedTotal = dailyPrice * diffDays;
    
    // Apply 10% discount for rentals longer than 5 days
    if (diffDays >= 5) {
      calculatedTotal = calculatedTotal * 0.9;
    }

    setTotalPrice(Math.round(calculatedTotal));
  }, [startDate, endDate, listing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!listing || !user) return;

    if (new Date(endDate) < new Date(startDate)) {
      alert('End date cannot be before start date.');
      return;
    }

    setSubmitting(true);

    // Simulate payment/rental confirmation
    setTimeout(() => {
      try {
        const newRental = {
          listingId: listing.id,
          listingTitle: listing.title,
          listingCategory: listing.category,
          listingImage: listing.image_url,
          renterId: user.id,
          startDate,
          endDate,
          totalDays,
          totalPrice,
          rentedAt: new Date().toISOString()
        };

        const existingRentals = JSON.parse(localStorage.getItem('campusmesh_rentals') || '[]');
        existingRentals.push(newRental);
        localStorage.setItem('campusmesh_rentals', JSON.stringify(existingRentals));

        setRentSuccess(true);
      } catch (err) {
        alert('Failed to process rental transaction.');
      } finally {
        setSubmitting(false);
      }
    }, 1500);
  };

  if (loading) {
    return (
      <div className="rent-container" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <div className="loading">Loading item details for rental...</div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="rent-container">
        <div className="error-message" style={{ margin: '3rem 0', textAlign: 'center' }}>
          {error || 'Listing not found.'}
        </div>
        <div style={{ textAlign: 'center' }}>
          <Link to="/" className="btn btn-primary">Back to Home</Link>
        </div>
      </div>
    );
  }

  const dailyPrice = listing ? parseFloat(listing.rent_price || listing.rentPrice || listing.price || 0) : 0;

  return (
    <div className="rent-container">
      <div className="rent-card">
        {rentSuccess ? (
          <div className="rent-success-view">
            <span className="success-icon">🎉</span>
            <h2>Rental Confirmed!</h2>
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>
              You have successfully rented <strong>{listing.title}</strong>.
            </p>
            <p className="text-muted">
              Please coordinate with the owner <strong>{listing.owner_name}</strong> at <strong>{listing.owner_email}</strong> for pickup details.
            </p>
            
            <div className="success-actions">
              <button onClick={() => navigate('/profile')} className="btn btn-primary">
                View My Rentals
              </button>
              <button onClick={() => navigate('/')} className="btn btn-outline">
                Browse More
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="rent-header">
              <h1>Rent Request</h1>
              <p>Borrow item from a student on campus</p>
            </div>

            <div className="rent-content">
              {/* Item Preview */}
              <div className="listing-preview-card">
                <div className="preview-img">
                  {listing.image_url ? (
                    <img src={listing.image_url} alt={listing.title} />
                  ) : (
                    <span>No Image</span>
                  )}
                </div>
                <div className="preview-info">
                  <span className="listing-category">{listing.category}</span>
                  <h3>{listing.title}</h3>
                  <p className="text-muted">Owner: {listing.owner_name}</p>
                  <p className="price-tag">₹{dailyPrice} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ day</span></p>
                </div>
              </div>

              {/* Rental Form */}
              <form onSubmit={handleSubmit}>
                <div className="rent-form-grid">
                  <div className="form-group">
                    <label className="form-label">Rental Start Date</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      required
                      min={todayStr}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rental End Date</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      required
                      min={startDate || todayStr}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Rental Summary */}
                {totalDays > 0 && (
                  <div className="rent-summary">
                    <div className="summary-row">
                      <span>Daily Rent Rate</span>
                      <span>₹{dailyPrice}</span>
                    </div>
                    <div className="summary-row">
                      <span>Duration</span>
                      <span>{totalDays} Days</span>
                    </div>
                    {totalDays >= 5 && (
                      <div className="summary-row" style={{ color: '#10b981', fontWeight: 600 }}>
                        <span>Discount (Long-term 5+ days)</span>
                        <span>-10%</span>
                      </div>
                    )}
                    <div className="summary-row total">
                      <span>Total Estimated Cost</span>
                      <span>₹{totalPrice}</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    disabled={submitting || totalDays <= 0}
                  >
                    {submitting ? 'Confirming Rental...' : 'Confirm Rental Booking'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => navigate('/')} 
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RentItem;
