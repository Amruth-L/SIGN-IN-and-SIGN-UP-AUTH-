const pool = require('../config/db');

exports.createListing = async (req, res) => {
  try {
    const { title, description, price, category, image_url } = req.body;
    const owner_id = req.user.id;

    if (!title || !description || !price || !category) {
      return res.status(400).json({ error: 'Title, description, price, and category are required' });
    }

    const newListing = await pool.query(
      'INSERT INTO listings (title, description, price, category, image_url, owner_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, description, price, category, image_url, owner_id]
    );

    res.status(201).json(newListing.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.getListings = async (req, res) => {
  try {
    const listings = await pool.query('SELECT * FROM listings ORDER BY created_at DESC');
    res.json(listings.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.getListingById = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await pool.query('SELECT * FROM listings WHERE id = $1', [id]);

    if (listing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json(listing.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server Error' });
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
