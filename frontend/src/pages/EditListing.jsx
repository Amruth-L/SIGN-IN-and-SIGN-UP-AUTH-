import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';

const EditListing = () => {
  const { api } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: 'Books',
    image_url: ''
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const res = await api.get(`/listings/${id}`);
        const { title, description, price, category, image_url } = res.data;
        setFormData({ 
          title, 
          description, 
          price: Math.round(price), 
          category, 
          image_url: image_url || '' 
        });
      } catch (err) {
        console.error(err);
        setError('Failed to load listing details');
      } finally {
        setFetching(false);
      }
    };
    fetchListing();
  }, [id, api]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.put(`/listings/${id}`, formData);
      navigate('/profile'); // Go back to profile after successful edit
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update listing');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="container" style={{ paddingTop: '3rem', textAlign: 'center' }}>Loading listing details...</div>;
  }

  return (
    <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Edit Listing</h2>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Calculus Textbook"
              required
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Category</label>
            <select 
              className="form-input"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            >
              <option value="Books">Books</option>
              <option value="Electronics">Electronics</option>
              <option value="Stationery">Stationery</option>
              <option value="Services">Services</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Price (₹)</label>
            <input 
              type="number" 
              className="form-input" 
              placeholder="e.g. 500"
              required
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({...formData, price: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Image URL (Optional)</label>
            <input 
              type="url" 
              className="form-input" 
              placeholder="https://example.com/image.jpg"
              value={formData.image_url}
              onChange={(e) => setFormData({...formData, image_url: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea 
              className="form-input" 
              placeholder="Provide details about the item..."
              required
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate('/profile')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditListing;
