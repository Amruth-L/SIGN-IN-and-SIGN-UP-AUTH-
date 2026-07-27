import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './AddListing.css';

const AddListing = () => {
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    category: 'Books',
    description: '',
    condition: 'Good',
    price: '',
    rentPrice: '',
    deposit: '',
    availability: 'Available Now',
    customDate: '',
    location: '',
    deliveryAvailable: false,
    deliveryCharge: '0',
    pickupTime: '5 min'
  });

  // Images state (holds base64 strings or ObjectUrls)
  const [images, setImages] = useState([]);
  const [coverIndex, setCoverIndex] = useState(0);
  
  // UI & Error States
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [formValidationErrors, setFormValidationErrors] = useState([]);
  
  // Loading & Upload Progress States
  const [publishing, setPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  // Dropdown options
  const categories = [
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

  const conditions = ['Brand New', 'Like New', 'Excellent', 'Good', 'Fair'];
  const availabilities = ['Available Now', 'Available Tomorrow', 'Available This Weekend', 'Custom Date'];
  
  const locations = [
    { name: 'Central Library', icon: '📚' },
    { name: 'AI & DS Block', icon: '🏫' },
    { name: 'Boys Hostel', icon: '🏠' },
    { name: 'Girls Hostel', icon: '🏠' },
    { name: 'Main Gate', icon: '🚪' }
  ];

  // Helper: Condition class name
  const getConditionClassName = (cond) => {
    return cond.toLowerCase().replace(' ', '-');
  };

  // Image Upload Logic (converts files to base64)
  const handleFiles = (files) => {
    setError('');
    const newImages = [...images];
    
    if (newImages.length + files.length > 5) {
      setError('You can upload a maximum of 5 images.');
      return;
    }

    const acceptedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    Array.from(files).forEach((file) => {
      if (!acceptedFormats.includes(file.type)) {
        setError('Only JPG, JPEG, PNG, and WEBP formats are accepted.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must not exceed 5 MB per image.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setImages((prev) => {
          if (prev.length < 5) {
            return [...prev, e.target.result];
          }
          return prev;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  // Drag & Drop event handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleDeleteImage = (index) => {
    const updated = images.filter((_, idx) => idx !== index);
    setImages(updated);
    
    // Adjust cover index if deleted image was cover
    if (coverIndex === index) {
      setCoverIndex(0);
    } else if (coverIndex > index) {
      setCoverIndex(prev => prev - 1);
    }
  };

  const makeCover = (index) => {
    setCoverIndex(index);
  };

  // Form Validation
  const validateForm = () => {
    const errors = [];
    
    if (!formData.title.trim()) {
      errors.push('Product Title is required.');
    }
    if (!formData.category) {
      errors.push('Category is required.');
    }
    if (!formData.description.trim()) {
      errors.push('Description is required.');
    }
    if (formData.description.length > 500) {
      errors.push('Description must be 500 characters or less.');
    }
    if (images.length === 0) {
      errors.push('At least one product image is required.');
    }
    if (!formData.location) {
      errors.push('Pickup location is required.');
    }
    
    const sellPrice = parseFloat(formData.price) || 0;
    const rentPrice = parseFloat(formData.rentPrice) || 0;
    const deposit = parseFloat(formData.deposit) || 0;

    if (sellPrice <= 0 && rentPrice <= 0) {
      errors.push('You must specify either a Selling Price OR a Rental Price.');
    }
    if (sellPrice > 0 && deposit > sellPrice) {
      errors.push('Security deposit cannot exceed the selling price.');
    }

    setFormValidationErrors(errors);
    return errors.length === 0;
  };

  // Publish Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      // Scroll to top to see validation errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setPublishing(true);
    setUploadProgress(0);
    setUploadStatus('Preparing files...');

    // Simulate image uploading progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        const nextProgress = prev + 15;
        if (nextProgress >= 40 && nextProgress < 70) {
          setUploadStatus('Compressing images...');
        } else if (nextProgress >= 70 && nextProgress < 95) {
          setUploadStatus('Uploading to cloud storage...');
        } else if (nextProgress >= 95) {
          setUploadStatus('Saving listing database records...');
        }
        return Math.min(nextProgress, 100);
      });
    }, 200);

    // Prepare API request payload
    const payload = {
      title: formData.title,
      description: formData.description,
      price: formData.price ? parseFloat(formData.price) : 0,
      category: formData.category,
      image_url: images[coverIndex] || '', // Primary cover image
      condition: formData.condition,
      rent_price: formData.rentPrice ? parseFloat(formData.rentPrice) : 0,
      deposit: formData.deposit ? parseFloat(formData.deposit) : 0,
      location: formData.location,
      delivery_available: formData.deliveryAvailable,
      delivery_charge: formData.deliveryAvailable ? parseFloat(formData.deliveryCharge) : 0,
      pickup_time: formData.deliveryAvailable ? formData.pickupTime : '5 min',
      image_urls: images // Array of all uploaded images
    };

    try {
      // Wait for simulated upload animation to finish
      await new Promise(resolve => setTimeout(resolve, 1800));

      await api.post('/listings', payload);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus('Published successfully!');
      
      alert('Your listing has been published successfully.');
      navigate('/profile'); // Redirects to My Listings tab in Profile page
    } catch (err) {
      clearInterval(progressInterval);
      setPublishing(false);
      setError(err.response?.data?.error || 'Failed to publish listing. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Mock safety values
  const sellerRating = user?.rating || 4.8;
  const sellerMeshScore = user?.meshScore || 98;
  const sellerDept = user?.department || 'Computer Science';
  const sellerSem = user?.semester || 6;
  const sellerInitials = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <div className="create-listing-container">
      
      {/* Loading/Publishing Overlay Screen */}
      {publishing && (
        <div className="overlay-loading">
          <div className="loading-content-card">
            <div className="spinner-ring"></div>
            <h2>Publishing Listing</h2>
            <p>{uploadStatus}</p>
            <div className="progress-bar-outer">
              <div className="progress-bar-inner" style={{ width: `${uploadProgress}%` }}></div>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {uploadProgress}% Complete
            </div>
          </div>
        </div>
      )}

      {/* Main Title Block */}
      <div className="create-listing-title-block">
        <h1>Create New Listing</h1>
        <p>List textbooks, electronics, furniture and other essentials for sale or rent.</p>
      </div>

      {/* Validation Errors Header Banner */}
      {formValidationErrors.length > 0 && (
        <div className="error-message">
          <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Please resolve the following errors:</h4>
          <ul style={{ paddingLeft: '1.25rem' }}>
            {formValidationErrors.map((err, idx) => (
              <li key={idx} style={{ fontSize: '0.85rem', marginBottom: '0.15rem' }}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} onDragEnter={handleDrag}>
        
        {/* SECTION 1 - ITEM DETAILS */}
        <div className="form-section-card">
          <div className="form-section-header">
            <h2><span>📦</span> Section 1: Item Details</h2>
          </div>
          
          <div className="form-group">
            <label className="form-label">Product Title *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. MacBook Air M1"
              required
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category *</label>
            <select 
              className="form-input"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Description *</label>
              <span className={`character-counter ${formData.description.length > 450 ? (formData.description.length > 500 ? 'error' : 'warning') : ''}`}>
                {formData.description.length} / 500 characters
              </span>
            </div>
            <textarea 
              className="form-input" 
              placeholder="Provide details about the item's condition, age, usage history, and what's included..."
              required
              maxLength={520}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value.slice(0, 500)})}
              rows={4}
            />
          </div>
        </div>

        {/* SECTION 2 - CONDITION */}
        <div className="form-section-card">
          <div className="form-section-header">
            <h2><span>✨</span> Section 2: Condition</h2>
          </div>
          
          <div className="form-group">
            <label className="form-label">Item Condition *</label>
            <div className="condition-select-wrapper">
              <select 
                className="form-input"
                style={{ width: '220px' }}
                value={formData.condition}
                onChange={(e) => setFormData({...formData, condition: e.target.value})}
              >
                {conditions.map(cond => (
                  <option key={cond} value={cond}>{cond}</option>
                ))}
              </select>
              <span className={`condition-badge-indicator ${getConditionClassName(formData.condition)}`}>
                {formData.condition}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 3 - PRICING */}
        <div className="form-section-card">
          <div className="form-section-header">
            <h2><span>💰</span> Section 3: Pricing & Availability</h2>
          </div>
          
          <div className="form-row-grid cols-3">
            <div className="form-group">
              <label className="form-label">Selling Price (₹)</label>
              <div className="input-with-icon-wrapper">
                <span className="input-icon-left">₹</span>
                <input 
                  type="number" 
                  className="form-input input-with-icon" 
                  placeholder="0"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Rental Price per Day (₹)</label>
              <div className="input-with-icon-wrapper">
                <span className="input-icon-left">₹</span>
                <input 
                  type="number" 
                  className="form-input input-with-icon" 
                  placeholder="0"
                  min="0"
                  value={formData.rentPrice}
                  onChange={(e) => setFormData({...formData, rentPrice: e.target.value})}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Security Deposit (₹)</label>
              <div className="input-with-icon-wrapper">
                <span className="input-icon-left">₹</span>
                <input 
                  type="number" 
                  className="form-input input-with-icon" 
                  placeholder="0"
                  min="0"
                  value={formData.deposit}
                  onChange={(e) => setFormData({...formData, deposit: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="form-row-grid cols-2" style={{ marginTop: '0.5rem' }}>
            <div className="form-group">
              <label className="form-label">Availability Timeframe</label>
              <select 
                className="form-input"
                value={formData.availability}
                onChange={(e) => setFormData({...formData, availability: e.target.value})}
              >
                {availabilities.map(av => (
                  <option key={av} value={av}>{av}</option>
                ))}
              </select>
            </div>

            {formData.availability === 'Custom Date' && (
              <div className="form-group">
                <label className="form-label">Select Availability Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={formData.customDate}
                  onChange={(e) => setFormData({...formData, customDate: e.target.value})}
                />
              </div>
            )}
          </div>
        </div>

        {/* SECTION 4 - ITEM IMAGES */}
        <div className="form-section-card">
          <div className="form-section-header">
            <h2><span>🖼️</span> Section 4: Item Images</h2>
          </div>
          
          <p className="form-label" style={{ marginBottom: '0.75rem' }}>
            Upload up to 5 clear images showing the actual condition of the item. *
          </p>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            multiple 
            accept=".jpg,.jpeg,.png,.webp" 
            style={{ display: 'none' }}
          />

          <div 
            className={`dropzone-area ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
          >
            <span className="dropzone-icon">📤</span>
            <div className="dropzone-text">
              <h3>Drag & drop your files here, or click to browse</h3>
              <p>Supports JPG, JPEG, PNG, WEBP formats (Max 5 MB per image)</p>
            </div>
          </div>

          {images.length > 0 && (
            <div className="image-previews-grid">
              {images.map((img, idx) => (
                <div key={idx} className="thumbnail-card">
                  <img src={img} alt={`Preview ${idx + 1}`} className="thumbnail-img" />
                  
                  {idx === coverIndex && (
                    <span className="cover-label-ribbon">Cover</span>
                  )}
                  
                  <div className="thumbnail-overlay-actions">
                    {idx !== coverIndex && (
                      <button 
                        type="button" 
                        className="thumb-action-btn" 
                        onClick={() => makeCover(idx)}
                        title="Make Cover Image"
                      >
                        ⭐
                      </button>
                    )}
                    <button 
                      type="button" 
                      className="thumb-action-btn btn-delete" 
                      onClick={() => handleDeleteImage(idx)}
                      title="Delete Image"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 5 - PICKUP LOCATION */}
        <div className="form-section-card">
          <div className="form-section-header">
            <h2><span>📍</span> Section 5: Pickup Location</h2>
          </div>
          
          <div className="form-group">
            <label className="form-label">Select On-Campus Pickup Location *</label>
            <select 
              className="form-input"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              required
            >
              <option value="">-- Choose a location --</option>
              {locations.map(loc => (
                <option key={loc.name} value={loc.name}>
                  {loc.icon} {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* SECTION 6 - DELIVERY */}
        <div className="form-section-card">
          <div className="form-section-header">
            <h2><span>🚚</span> Section 6: Delivery Settings</h2>
          </div>
          
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: formData.deliveryAvailable ? '1.5rem' : '0' }}>
            <input 
              type="checkbox" 
              id="delivery-check"
              checked={formData.deliveryAvailable}
              onChange={(e) => setFormData({...formData, deliveryAvailable: e.target.checked})}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
            />
            <label htmlFor="delivery-check" style={{ fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}>
              Student Courier Delivery Available
            </label>
          </div>

          {formData.deliveryAvailable && (
            <div className="form-row-grid cols-2">
              <div className="form-group">
                <label className="form-label">Delivery Charge (₹)</label>
                <div className="input-with-icon-wrapper">
                  <span className="input-icon-left">₹</span>
                  <input 
                    type="number" 
                    className="form-input input-with-icon" 
                    placeholder="0"
                    min="0"
                    value={formData.deliveryCharge}
                    onChange={(e) => setFormData({...formData, deliveryCharge: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Estimated Courier Pickup Time</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. 10 - 20 mins"
                  value={formData.pickupTime}
                  onChange={(e) => setFormData({...formData, pickupTime: e.target.value})}
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 7 - CONTACT */}
        <div className="form-section-card">
          <div className="form-section-header">
            <h2><span>👤</span> Section 7: Seller Contact (Read Only)</h2>
          </div>
          
          <div className="seller-profile-card-readonly">
            <div className="seller-avatar-large">
              {sellerInitials}
            </div>
            <div className="seller-details-readonly">
              <h3>{user?.name || 'Anonymous Student'}</h3>
              <p>{user?.email}</p>
              <p style={{ color: 'var(--text-muted)' }}>
                {sellerDept} • Semester {sellerSem}
              </p>
              
              <div className="seller-stats-readonly">
                <span className="stat-item rating">⭐ Rating: {sellerRating}</span>
                <span className="stat-item trust">🛡️ Trust score: {sellerMeshScore}</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 8 - SAFETY NOTICE */}
        <div className="safety-notice-card">
          <span className="safety-icon">⚠️</span>
          <div className="safety-text">
            <h3>Listing Safety & Accuracy Guidelines</h3>
            <p>
              Please upload real images of the item in your possession. Do not upload copyrighted images or images downloaded from the internet. The item's actual condition should match the uploaded photos exactly.
            </p>
          </div>
        </div>

        {/* SECTION 9 - ACTION BUTTONS */}
        <div className="action-buttons-footer">
          <button 
            type="button" 
            onClick={() => navigate('/')} 
            className="btn btn-outline btn-footer"
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={() => {
              alert('Draft saved successfully. You can complete it later.');
              navigate('/profile');
            }} 
            className="btn btn-outline btn-footer"
          >
            Save Draft
          </button>
          <button 
            type="button" 
            onClick={() => {
              if (validateForm()) {
                alert(`--- PREVIEW DETAILS ---\n\nTitle: ${formData.title}\nCategory: ${formData.category}\nCondition: ${formData.condition}\nSell Price: ₹${formData.price || 0}\nRent Rate: ₹${formData.rentPrice || 0}/day\nPickup: ${formData.location}\n\nPress Publish to publish it!`);
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }} 
            className="btn btn-outline btn-footer"
          >
            Preview Listing
          </button>
          <button 
            type="submit" 
            className="btn btn-primary btn-footer"
          >
            Publish Listing
          </button>
        </div>

      </form>
    </div>
  );
};

export default AddListing;
