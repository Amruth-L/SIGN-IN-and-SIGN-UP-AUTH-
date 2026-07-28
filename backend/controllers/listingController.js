const pool = require('../config/db');

exports.createListing = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      price, 
      category, 
      image_url,
      condition,
      rent_price,
      deposit,
      location,
      delivery_available,
      delivery_charge,
      pickup_time,
      image_urls
    } = req.body;
    
    const owner_id = req.user.id;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Product Title is required.' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ error: 'Category is required.' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required.' });
    }
    if (description.length > 500) {
      return res.status(400).json({ error: 'Description cannot exceed 500 characters.' });
    }
    if (!image_url && (!image_urls || image_urls.length === 0)) {
      return res.status(400).json({ error: 'At least one image is required.' });
    }
    if (!location || !location.trim()) {
      return res.status(400).json({ error: 'Pickup location is required.' });
    }
    
    const sellPrice = parseFloat(price) || 0;
    const rentPrice = parseFloat(rent_price) || 0;
    const securityDeposit = parseFloat(deposit) || 0;

    if (sellPrice <= 0 && rentPrice <= 0) {
      return res.status(400).json({ error: 'Either Selling Price or Rental Price must be provided.' });
    }
    if (sellPrice > 0 && securityDeposit > sellPrice) {
      return res.status(400).json({ error: 'Security deposit cannot exceed the selling price.' });
    }

    const queryText = `
      INSERT INTO listings (
        title, description, price, category, image_url, owner_id,
        condition, rent_price, deposit, location, delivery_available, delivery_charge, pickup_time, image_urls
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      title.trim(),
      description.trim(),
      sellPrice,
      category.trim(),
      image_url || (image_urls && image_urls[0]) || '',
      owner_id,
      condition || 'Good',
      rentPrice,
      securityDeposit,
      location.trim(),
      !!delivery_available,
      parseFloat(delivery_charge) || 0,
      pickup_time || '5 min',
      image_urls || []
    ];

    const newListing = await pool.query(queryText, values);

    res.status(201).json(newListing.rows[0]);
  } catch (error) {
    console.error('Error in createListing:', error.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.getListings = async (req, res) => {
  try {
    const listings = await pool.query(`
      SELECT l.*, u.name as owner_name, u.email as owner_email 
      FROM listings l 
      JOIN users u ON l.owner_id = u.id 
      ORDER BY l.created_at DESC
    `);
    res.json(listings.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.getListingById = async (req, res) => {
  const { id } = req.params;
  console.log(`[Backend Debug] GET /api/listings/:id request received for ID: "${id}"`);

  // Validate UUID format before querying PostgreSQL
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(id)) {
    console.warn(`[Backend Debug] Rejecting request: "${id}" is not a valid UUID.`);
    return res.status(400).json({ error: 'Invalid listing ID format.' });
  }

  try {
    console.log(`[Backend Debug] Executing database query for listing ID: "${id}"`);
    const listing = await pool.query(`
      SELECT l.*, u.name as owner_name, u.email as owner_email 
      FROM listings l 
      JOIN users u ON l.owner_id = u.id 
      WHERE l.id = $1
    `, [id]);

    if (listing.rows.length === 0) {
      console.log(`[Backend Debug] Query finished: Listing ID "${id}" not found in database.`);
      return res.status(404).json({ error: 'Listing not found.' });
    }

    console.log(`[Backend Debug] Listing found:`, listing.rows[0].title);
    res.json(listing.rows[0]);
  } catch (error) {
    console.error(`[Backend Debug] Database query failed:`, error.message || error);
    res.status(500).json({ error: 'Database query execution error.' });
  }
};

exports.updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, category, image_url } = req.body;
    const owner_id = req.user.id;

    // Check if listing exists and belongs to user
    const listingCheck = await pool.query('SELECT * FROM listings WHERE id = $1', [id]);
    if (listingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    if (listingCheck.rows[0].owner_id !== owner_id) {
      return res.status(403).json({ error: 'Forbidden: You can only edit your own listings' });
    }

    const updatedListing = await pool.query(
      'UPDATE listings SET title = $1, description = $2, price = $3, category = $4, image_url = $5 WHERE id = $6 RETURNING *',
      [title, description, price, category, image_url, id]
    );

    res.json(updatedListing.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    const owner_id = req.user.id;

    // Check if listing exists and belongs to user
    const listingCheck = await pool.query('SELECT * FROM listings WHERE id = $1', [id]);
    if (listingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    if (listingCheck.rows[0].owner_id !== owner_id) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own listings' });
    }

    await pool.query('DELETE FROM listings WHERE id = $1', [id]);

    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server Error' });
  }
};
