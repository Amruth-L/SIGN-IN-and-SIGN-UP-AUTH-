import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const DRAFT_STORAGE_KEY = 'campusmesh_listing_draft';

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

  // Restore a locally saved draft when the create-listing page is opened again.
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!savedDraft) return;

      const draft = JSON.parse(savedDraft);
      if (draft.formData) {
        setFormData((current) => ({ ...current, ...draft.formData }));
      }
      if (Array.isArray(draft.images)) setImages(draft.images);
      if (Number.isInteger(draft.coverIndex)) setCoverIndex(draft.coverIndex);
    } catch (draftError) {
      console.warn('Unable to restore listing draft:', draftError);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, []);

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
    setUploadProgress(25);
    setUploadStatus('Saving listing and images...');

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
      await api.post('/listings', payload);

      setUploadProgress(100);
      setUploadStatus('Published successfully!');
      localStorage.removeItem(DRAFT_STORAGE_KEY);

      alert('Your listing has been published successfully.');
      navigate('/account/listings');
    } catch (err) {
      setPublishing(false);
      setError(err.response?.data?.error || 'Failed to publish listing. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveDraft = () => {
    const draft = {
      formData,
      images,
      coverIndex,
      savedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      alert('Draft saved successfully. You can continue it later.');
    } catch (storageError) {
      // Large base64 images can exceed the browser's localStorage quota. Keep
      // the form fields so the draft is still useful, even if images cannot be
      // stored locally.
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          formData,
          coverIndex,
          savedAt: new Date().toISOString()
        }));
        alert('Draft details saved. The images were too large to save locally, so please select them again later.');
      } catch (fallbackError) {
        console.error('Unable to save listing draft:', storageError, fallbackError);
        setError('Unable to save the draft in this browser. Please try again or use smaller images.');
      }
    }
  };

  // Mock safety values
  const sellerRating = user?.rating || 4.8;
  const sellerMeshScore = user?.meshScore || 98;
  const sellerDept = user?.department || 'Computer Science';
  const sellerSem = user?.semester || 6;
  const sellerInitials = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <main className="min-h-screen bg-paper px-5 py-10 sm:px-7">

      {/* Loading/Publishing Overlay Screen */}
      {publishing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-5 backdrop-blur-sm">
          <div className="[background-color:var(--surface-color)] [padding:3rem] [border-radius:var(--radius-lg)] [border:1px_solid_var(--border-color)] [max-width:450px] [width:90%] text-center [box-shadow:var(--shadow-lg)] [animation:scaleIn_0.3s_cubic-bezier(0.34,_1.56,_0.64,_1)]">
            <div className="size-10 animate-spin rounded-full border-4 border-mesh-100 border-t-mesh-600"></div>
            <h2>Publishing Listing</h2>
            <p>{uploadStatus}</p>
            <div className="w-full [height:8px] [background-color:var(--bg-color)] [border-radius:999px] overflow-hidden [border:1px_solid_var(--border-color)]">
              <progress className="h-full w-full accent-mesh-600" value={uploadProgress} max="100" />
            </div>
            <div className="mt-2 text-xs font-semibold text-ink/50">
              {uploadProgress}% Complete
            </div>
          </div>
        </div>
      )}

      {/* Main Title Block */}
      <div className="[margin-bottom:2.5rem]">
        <h1>Create New Listing</h1>
        <p>Add the item details.</p>
      </div>

      {/* Validation Errors Header Banner */}
      {formValidationErrors.length > 0 && (
        <div className="space-y-4">
          <h4 className="mb-2 font-bold">Please resolve the following errors:</h4>
          <ul className="pl-5">
            {formValidationErrors.map((err, idx) => (
              <li key={idx} className="mb-0.5 text-sm">{err}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="space-y-4">{error}</div>}

      <form onSubmit={handleSubmit} onDragEnter={handleDrag}>

        {/* SECTION 1 - ITEM DETAILS */}
        <div className="hover:[box-shadow:var(--shadow-md)]">
          <div className="flex justify-between items-center [margin-bottom:1.5rem] [padding-bottom:0.75rem] [border-bottom:1px_solid_var(--border-color)]">
            <h2><span>📦</span> Section 1: Item Details</h2>
          </div>

          <div className="space-y-4">
            <label className="mb-1.5 block text-xs font-bold text-ink/60">Product Title *</label>
            <input
              type="text"
              className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
              placeholder="e.g. MacBook Air M1"
              required
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div className="space-y-4">
            <label className="mb-1.5 block text-xs font-bold text-ink/60">Category *</label>
            <select
              className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs font-bold text-ink/60">Description *</label>
              <span className={`text-xs font-medium ${formData.description.length > 500 ? 'text-red-600' : formData.description.length > 450 ? 'text-amber-600' : 'text-ink/45'}`}>
                {formData.description.length} / 500 characters
              </span>
            </div>
            <textarea
              className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
              placeholder="Condition and what is included"
              required
              maxLength={520}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value.slice(0, 500)})}
              rows={4}
            />
          </div>
        </div>

        {/* SECTION 2 - CONDITION */}
        <div className="hover:[box-shadow:var(--shadow-md)]">
          <div className="flex justify-between items-center [margin-bottom:1.5rem] [padding-bottom:0.75rem] [border-bottom:1px_solid_var(--border-color)]">
            <h2><span>✨</span> Section 2: Condition</h2>
          </div>

          <div className="space-y-4">
            <label className="mb-1.5 block text-xs font-bold text-ink/60">Item Condition *</label>
            <div className="relative">
              <select
                className="h-11 w-[220px] rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                value={formData.condition}
                onChange={(e) => setFormData({...formData, condition: e.target.value})}
              >
                {conditions.map(cond => (
                  <option key={cond} value={cond}>{cond}</option>
                ))}
              </select>
              <span className={`[padding:0.25rem_0.75rem] [border-radius:4px] [font-size:0.75rem] font-bold uppercase [color:white] [transition:all_0.2s_ease] ${getConditionClassName(formData.condition)}`}>
                {formData.condition}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 3 - PRICING */}
        <div className="hover:[box-shadow:var(--shadow-md)]">
          <div className="flex justify-between items-center [margin-bottom:1.5rem] [padding-bottom:0.75rem] [border-bottom:1px_solid_var(--border-color)]">
            <h2><span>💰</span> Section 3: Pricing & Availability</h2>
          </div>

          <div className="grid [grid-template-columns:1fr] [gap:1.5rem] [grid-template-columns:repeat(3,_1fr)]">
            <div className="space-y-4">
              <label className="mb-1.5 block text-xs font-bold text-ink/60">Selling Price (₹)</label>
              <div className="space-y-4">
                <span className="absolute [left:1rem] [font-size:1rem] [color:var(--text-muted)] pointer-events-none">₹</span>
                <input
                  type="number"
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 pl-9 text-sm outline-none focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  placeholder="0"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="mb-1.5 block text-xs font-bold text-ink/60">Rental Price per Day (₹)</label>
              <div className="space-y-4">
                <span className="absolute [left:1rem] [font-size:1rem] [color:var(--text-muted)] pointer-events-none">₹</span>
                <input
                  type="number"
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 pl-9 text-sm outline-none focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  placeholder="0"
                  min="0"
                  value={formData.rentPrice}
                  onChange={(e) => setFormData({...formData, rentPrice: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="mb-1.5 block text-xs font-bold text-ink/60">Security Deposit (₹)</label>
              <div className="space-y-4">
                <span className="absolute [left:1rem] [font-size:1rem] [color:var(--text-muted)] pointer-events-none">₹</span>
                <input
                  type="number"
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 pl-9 text-sm outline-none focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  placeholder="0"
                  min="0"
                  value={formData.deposit}
                  onChange={(e) => setFormData({...formData, deposit: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="mt-2 grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <label className="mb-1.5 block text-xs font-bold text-ink/60">Availability Timeframe</label>
              <select
                className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                value={formData.availability}
                onChange={(e) => setFormData({...formData, availability: e.target.value})}
              >
                {availabilities.map(av => (
                  <option key={av} value={av}>{av}</option>
                ))}
              </select>
            </div>

            {formData.availability === 'Custom Date' && (
              <div className="space-y-4">
                <label className="mb-1.5 block text-xs font-bold text-ink/60">Select Availability Date</label>
                <input
                  type="date"
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  value={formData.customDate}
                  onChange={(e) => setFormData({...formData, customDate: e.target.value})}
                />
              </div>
            )}
          </div>
        </div>

        {/* SECTION 4 - ITEM IMAGES */}
        <div className="hover:[box-shadow:var(--shadow-md)]">
          <div className="flex justify-between items-center [margin-bottom:1.5rem] [padding-bottom:0.75rem] [border-bottom:1px_solid_var(--border-color)]">
            <h2><span>🖼️</span> Section 4: Item Images</h2>
          </div>

          <p className="mb-3">
            Upload up to 5 clear images showing the actual condition of the item. *
          </p>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept=".jpg,.jpeg,.png,.webp"
            className="hidden"
          />

          <div
            className={`hover:[border-color:var(--primary-color)] hover:[background-color:rgba(16,_185,_129,_0.03)] ${dragActive ? '[border-color:var(--primary-color)] [background-color:rgba(16,_185,_129,_0.03)]' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
          >
            <span className="[font-size:2.5rem] [color:var(--text-muted)] [margin-bottom:0.75rem]">📤</span>
            <div className="space-y-1 text-center">
              <h3>Choose item photos</h3>
              <p>JPG, PNG or WEBP · 5 MB max</p>
            </div>
          </div>

          {images.length > 0 && (
            <div className="space-y-4">
              {images.map((img, idx) => (
                <div key={idx} className="[height:120px] [border-radius:var(--radius-md)] [border:1px_solid_var(--border-color)] relative overflow-hidden [box-shadow:var(--shadow-sm)] [background-color:#f3f4f6]">
                  <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />

                  {idx === coverIndex && (
                    <span className="absolute [bottom:0] [left:0] [right:0] [background-color:var(--primary-color)] [color:white] [font-size:0.65rem] font-extrabold text-center [padding:0.15rem_0] [z-index:1] [letter-spacing:0.05em] uppercase">Cover</span>
                  )}

                  <div className="absolute [top:0] [left:0] [right:0] [bottom:0] [background-color:rgba(0,_0,_0,_0.45)] flex items-center justify-center [gap:0.5rem] [opacity:0] [transition:opacity_0.2s_ease] [z-index:2]">
                    {idx !== coverIndex && (
                      <button
                        type="button"
                        className="grid size-8 place-items-center rounded-lg border border-ink/10 bg-white text-ink/60 hover:bg-mesh-50"
                        onClick={() => makeCover(idx)}
                        title="Make Cover Image"
                      >
                        ⭐
                      </button>
                    )}
                    <button
                      type="button"
                      className="grid size-8 place-items-center rounded-lg border border-ink/10 bg-white text-ink/60 hover:bg-mesh-50 [color:#ef4444]"
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
        <div className="hover:[box-shadow:var(--shadow-md)]">
          <div className="flex justify-between items-center [margin-bottom:1.5rem] [padding-bottom:0.75rem] [border-bottom:1px_solid_var(--border-color)]">
            <h2><span>📍</span> Section 5: Pickup Location</h2>
          </div>

          <div className="space-y-4">
            <label className="mb-1.5 block text-xs font-bold text-ink/60">Select On-Campus Pickup Location *</label>
            <select
              className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
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
        <div className="hover:[box-shadow:var(--shadow-md)]">
          <div className="flex justify-between items-center [margin-bottom:1.5rem] [padding-bottom:0.75rem] [border-bottom:1px_solid_var(--border-color)]">
            <h2><span>🚚</span> Section 6: Delivery Settings</h2>
          </div>

          <div className={`flex items-center gap-2 ${formData.deliveryAvailable ? 'mb-6' : ''}`}>
            <input
              type="checkbox"
              id="delivery-check"
              checked={formData.deliveryAvailable}
              onChange={(e) => setFormData({...formData, deliveryAvailable: e.target.checked})}
              className="size-[18px] cursor-pointer accent-mesh-600"
            />
            <label htmlFor="delivery-check" className="cursor-pointer text-sm font-semibold">
              Student Courier Delivery Available
            </label>
          </div>

          {formData.deliveryAvailable && (
            <div className="grid [grid-template-columns:1fr] [gap:1.5rem] [grid-template-columns:1fr_1fr]">
              <div className="space-y-4">
                <label className="mb-1.5 block text-xs font-bold text-ink/60">Delivery Charge (₹)</label>
                <div className="space-y-4">
                  <span className="absolute [left:1rem] [font-size:1rem] [color:var(--text-muted)] pointer-events-none">₹</span>
                  <input
                    type="number"
                    className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 pl-9 text-sm outline-none focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                    placeholder="0"
                    min="0"
                    value={formData.deliveryCharge}
                    onChange={(e) => setFormData({...formData, deliveryCharge: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="mb-1.5 block text-xs font-bold text-ink/60">Estimated Courier Pickup Time</label>
                <input
                  type="text"
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
                  placeholder="e.g. 10 - 20 mins"
                  value={formData.pickupTime}
                  onChange={(e) => setFormData({...formData, pickupTime: e.target.value})}
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 7 - CONTACT */}
        <div className="hover:[box-shadow:var(--shadow-md)]">
          <div className="flex justify-between items-center [margin-bottom:1.5rem] [padding-bottom:0.75rem] [border-bottom:1px_solid_var(--border-color)]">
            <h2><span>👤</span> Section 7: Seller Contact (Read Only)</h2>
          </div>

          <div className="rounded-2xl border border-ink/10 bg-mesh-50 p-4">
            <div className="[width:60px] [height:60px] [border-radius:50%] [background-color:var(--primary-color)] [color:white] flex items-center justify-center [font-size:1.5rem] font-extrabold [box-shadow:var(--shadow-sm)] [border:2px_solid_var(--border-color)]">
              {sellerInitials}
            </div>
            <div className="grid gap-1 text-sm text-ink/55">
              <h3>{user?.name || 'Anonymous Student'}</h3>
              <p>{user?.email}</p>
              <p className="text-ink/50">
                {sellerDept} • Semester {sellerSem}
              </p>

              <div className="flex [gap:1rem] [margin-top:0.35rem] [font-size:0.8rem] font-semibold">
                <span className="text-amber-600">⭐ Rating: {sellerRating}</span>
                <span className="text-mesh-700">🛡️ Trust score: {sellerMeshScore}</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 8 - SAFETY NOTICE */}
        <div className="flex gap-3 rounded-2xl border border-mesh-200 bg-mesh-50 p-4">
          <span className="[font-size:1.5rem] [color:var(--primary-color)]">⚠️</span>
          <div className="text-sm text-ink/60">
            <h3>Listing Safety & Accuracy Guidelines</h3>
            <p>
              Please upload real images of the item in your possession. Do not upload copyrighted images or images downloaded from the internet. The item's actual condition should match the uploaded photos exactly.
            </p>
          </div>
        </div>

        {/* SECTION 9 - ACTION BUTTONS */}
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/marketplace')}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-ink/15 bg-white px-5 text-sm font-bold text-ink hover:bg-mesh-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-ink/15 bg-white px-5 text-sm font-bold text-ink hover:bg-mesh-50"
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
            className="inline-flex h-11 items-center justify-center rounded-xl border border-ink/15 bg-white px-5 text-sm font-bold text-ink hover:bg-mesh-50"
          >
            Preview Listing
          </button>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-ink/15 bg-white px-5 text-sm font-bold text-ink hover:bg-mesh-50"
          >
            Publish Listing
          </button>
        </div>

      </form>
    </main>
  );
};

export default AddListing;
