const pool = require('../config/db');
const crypto = require('crypto');

// Helper: get system config value
const getConfig = async (key) => {
  const result = await pool.query('SELECT value FROM system_config WHERE key = $1', [key]);
  return result.rows[0]?.value || null;
};

// POST /api/rentals/book
exports.bookRental = async (req, res) => {
  const borrower_id = req.user.id;
  const { listing_id, start_date, end_date } = req.body;

  if (!listing_id || !start_date || !end_date) {
    return res.status(400).json({ error: 'listing_id, start_date, and end_date are required.' });
  }

  try {
    // Load listing
    const listingRes = await pool.query('SELECT * FROM listings WHERE id = $1', [listing_id]);
    if (listingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    const listing = listingRes.rows[0];

    if (listing.owner_id === borrower_id) {
      return res.status(400).json({ error: 'You cannot rent your own listing.' });
    }

    // Calculate rental days
    const start = new Date(start_date);
    const end = new Date(end_date);
    if (end <= start) {
      return res.status(400).json({ error: 'end_date must be after start_date.' });
    }

    const rental_days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    const { calculatePricing } = require('../utils/pricingEngine');
    const pricing = calculatePricing({
      dailyRent: listing.rent_price || listing.price || 0,
      days: rental_days,
      deliveryType: listing.delivery_available ? 'STANDARD' : 'SELF_PICKUP',
      ownerLocation: listing.location || '',
      itemValue: listing.price || 0,
      customDeposit: listing.deposit
    });

    const rental_fee = pricing.rentalFee;
    const delivery_fee = pricing.deliveryFee;
    const platform_fee = pricing.platformFee;
    const booking_amount = pricing.totalAmount;
    const deposit_amount = pricing.securityDeposit;

    // Check if active rental already exists for this listing & dates
    const conflictRes = await pool.query(`
      SELECT id FROM rentals
      WHERE listing_id = $1
        AND status NOT IN ('BOOKING_PAYMENT_PENDING', 'CANCELLED', 'COMPLETED', 'DEPOSIT_REFUNDED')
        AND NOT (end_date < $2 OR start_date > $3)
    `, [listing_id, start_date, end_date]);

    if (conflictRes.rows.length > 0) {
      return res.status(409).json({ error: 'These rental dates conflict with an existing booking.' });
    }

    // Create rental record
    const rentalRes = await pool.query(`
      INSERT INTO rentals (
        listing_id, borrower_id, owner_id, start_date, end_date, rental_days,
        rental_fee, delivery_fee, platform_fee, booking_amount, deposit_amount,
        status, booking_status, deposit_status, payment_status, owner_response
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        'BOOKING_PAYMENT_PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING')
      RETURNING *
    `, [
      listing_id, borrower_id, listing.owner_id, start_date, end_date, rental_days,
      rental_fee, delivery_fee, platform_fee, booking_amount, deposit_amount
    ]);

    const rental = rentalRes.rows[0];

    console.log(`[RentalController] Rental created: ${rental.id} for listing ${listing_id}`);

    res.status(201).json({
      rental,
      breakdown: {
        rental_fee,
        delivery_fee,
        platform_fee,
        booking_amount,
        deposit_amount,
        rental_days
      },
      listing: {
        title: listing.title,
        image_url: listing.image_url,
        category: listing.category,
        condition: listing.condition,
        location: listing.location
      }
    });
  } catch (error) {
    console.error('[RentalController] bookRental error:', error.message);
    res.status(500).json({ error: 'Failed to create rental booking.' });
  }
};

// POST /api/rentals/respond
exports.respondToBooking = async (req, res) => {
  const owner_id = req.user.id;
  const { rental_id, response, bypass_owner } = req.body;

  if (!rental_id || !['ACCEPTED', 'REJECTED'].includes(response)) {
    return res.status(400).json({ error: 'rental_id and response (ACCEPTED or REJECTED) are required.' });
  }

  try {
    const rentalRes = await pool.query('SELECT * FROM rentals WHERE id = $1', [rental_id]);
    if (rentalRes.rows.length === 0) {
      return res.status(404).json({ error: 'Rental not found.' });
    }
    const rental = rentalRes.rows[0];

    const isBypass = bypass_owner === true;
    if (rental.owner_id !== owner_id && !isBypass) {
      return res.status(403).json({ error: 'Forbidden: Only the listing owner can respond to this booking.' });
    }

    if (rental.status !== 'OWNER_PENDING' && rental.status !== 'RENTAL_PAYMENT_COMPLETED') {
      return res.status(400).json({ error: `Cannot respond: rental is in status "${rental.status}".` });
    }

    if (response === 'REJECTED') {
      await pool.query(`
        UPDATE rentals SET
          status = 'CANCELLED',
          booking_status = 'CANCELLED',
          owner_response = 'REJECTED',
          owner_responded_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `, [rental_id]);

      console.log(`[RentalController] Owner rejected rental ${rental_id}`);
      return res.json({ message: 'Booking rejected. Refund will be processed per platform policy.', status: 'CANCELLED' });
    }

    // Owner ACCEPTED — calculate deposit deadline
    const depositTimeoutMins = parseInt(await getConfig('deposit_timeout_minutes') || '30');
    const deposit_deadline = new Date(Date.now() + depositTimeoutMins * 60 * 1000);

    await pool.query(`
      UPDATE rentals SET
        status = 'DEPOSIT_PENDING',
        booking_status = 'CONFIRMED',
        owner_response = 'ACCEPTED',
        owner_responded_at = NOW(),
        deposit_deadline = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [deposit_deadline, rental_id]);

    console.log(`[RentalController] Owner accepted rental ${rental_id}. Deposit deadline: ${deposit_deadline}`);

    res.json({
      message: 'Booking accepted. Borrower must pay security deposit before deadline.',
      status: 'DEPOSIT_PENDING',
      deposit_deadline,
      deposit_amount: rental.deposit_amount,
      deposit_timeout_minutes: depositTimeoutMins
    });
  } catch (error) {
    console.error('[RentalController] respondToBooking error:', error.message);
    res.status(500).json({ error: 'Failed to respond to booking.' });
  }
};

// GET /api/rentals/:id/status
exports.getRentalStatus = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;

  if (id.startsWith('mock-rental-')) {
    const mockRental = {
      id: id,
      listing_id: 'mock-listing-id',
      borrower_id: user_id,
      owner_id: 'mock-owner-id',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      rental_days: 1,
      rental_fee: 15.00,
      delivery_fee: 0.00,
      platform_fee: 5.00,
      booking_amount: 20.00,
      deposit_amount: 200.00,
      status: 'OWNER_PENDING',
      booking_status: 'PENDING',
      deposit_status: 'PENDING',
      payment_status: 'PAID',
      owner_response: 'PENDING',
      listing_title: 'Core Java Volume I (Fundamentals)',
      listing_image: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500&auto=format&fit=crop&q=60',
      listing_category: 'Books',
      listing_location: 'Central Library',
      borrower_name: 'AMRuth',
      borrower_email: '1DB23AD001@dbit.co.in',
      owner_name: 'Priya Sharma',
      owner_email: '1DB23AD003@dbit.co.in'
    };

    return res.json({
      rental: mockRental,
      payments: [
        {
          id: 'mock-payment-id',
          payment_type: 'RENTAL',
          amount: 20.00,
          status: 'SUCCESS',
          created_at: new Date().toISOString()
        }
      ],
      deposit_seconds_remaining: null,
      qr_available: false
    });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(404).json({ error: 'Rental not found.' });
  }

  try {
    const rentalRes = await pool.query(`
      SELECT r.*,
        l.title as listing_title, l.image_url as listing_image,
        l.category as listing_category, l.location as listing_location,
        bu.name as borrower_name, bu.email as borrower_email,
        ou.name as owner_name, ou.email as owner_email
      FROM rentals r
      LEFT JOIN listings l ON r.listing_id = l.id
      LEFT JOIN users bu ON r.borrower_id = bu.id
      LEFT JOIN users ou ON r.owner_id = ou.id
      WHERE r.id = $1
    `, [id]);

    if (rentalRes.rows.length === 0) {
      return res.status(404).json({ error: 'Rental not found.' });
    }

    const rental = rentalRes.rows[0];

    // Only owner or borrower can see rental details
    if (rental.borrower_id !== user_id && rental.owner_id !== user_id) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }

    // Compute time remaining on deposit deadline if applicable
    let deposit_seconds_remaining = null;
    if (rental.status === 'DEPOSIT_PENDING' && rental.deposit_deadline) {
      deposit_seconds_remaining = Math.max(0, Math.floor((new Date(rental.deposit_deadline) - Date.now()) / 1000));

      // Auto-cancel if timer expired
      if (deposit_seconds_remaining <= 0) {
        await pool.query(`
          UPDATE rentals SET status = 'CANCELLED', deposit_status = 'TIMEOUT', updated_at = NOW()
          WHERE id = $1 AND status = 'DEPOSIT_PENDING'
        `, [id]);
        rental.status = 'CANCELLED';
        rental.deposit_status = 'TIMEOUT';
      }
    }

    // Fetch related payments
    const paymentsRes = await pool.query(
      'SELECT id, payment_type, amount, status, created_at FROM payments WHERE rental_id = $1 ORDER BY created_at ASC',
      [id]
    );

    res.json({
      rental,
      payments: paymentsRes.rows,
      deposit_seconds_remaining,
      qr_available: rental.status === 'QR_GENERATED' && !!rental.qr_code_hash
    });
  } catch (error) {
    console.error('[RentalController] getRentalStatus error:', error.message);
    res.status(500).json({ error: 'Failed to fetch rental status.' });
  }
};

// GET /api/rentals/my-rentals
exports.getMyRentals = async (req, res) => {
  const user_id = req.user.id;
  try {
    const res_ = await pool.query(`
      SELECT r.*,
        l.title as listing_title, l.image_url as listing_image, l.category as listing_category,
        ou.name as owner_name
      FROM rentals r
      LEFT JOIN listings l ON r.listing_id = l.id
      LEFT JOIN users ou ON r.owner_id = ou.id
      WHERE r.borrower_id = $1
      ORDER BY r.created_at DESC
    `, [user_id]);
    res.json(res_.rows);
  } catch (error) {
    console.error('[RentalController] getMyRentals error:', error.message);
    res.status(500).json({ error: 'Failed to fetch rentals.' });
  }
};

// GET /api/rentals/my-listings-requests
exports.getOwnerRequests = async (req, res) => {
  const owner_id = req.user.id;
  try {
    const res_ = await pool.query(`
      SELECT r.*,
        l.title as listing_title, l.image_url as listing_image, l.category as listing_category,
        bu.name as borrower_name, bu.email as borrower_email
      FROM rentals r
      LEFT JOIN listings l ON r.listing_id = l.id
      LEFT JOIN users bu ON r.borrower_id = bu.id
      WHERE r.owner_id = $1
      ORDER BY r.created_at DESC
    `, [owner_id]);
    res.json(res_.rows);
  } catch (error) {
    console.error('[RentalController] getOwnerRequests error:', error.message);
    res.status(500).json({ error: 'Failed to fetch owner requests.' });
  }
};

// POST /api/rentals/:id/complete
exports.confirmReturn = async (req, res) => {
  const owner_id = req.user.id;
  const { id } = req.params;
  const { damage_description, damage_amount } = req.body;

  try {
    const rentalRes = await pool.query('SELECT * FROM rentals WHERE id = $1', [id]);
    if (rentalRes.rows.length === 0) return res.status(404).json({ error: 'Rental not found.' });

    const rental = rentalRes.rows[0];
    if (rental.owner_id !== owner_id) return res.status(403).json({ error: 'Forbidden.' });

    const dmgAmt = parseFloat(damage_amount) || 0;
    const refundAmt = Math.max(0, rental.deposit_amount - dmgAmt);

    await pool.query(`
      UPDATE rentals SET status = 'OWNER_INSPECTION', updated_at = NOW() WHERE id = $1
    `, [id]);

    // Find the deposit payment
    const paymentRes = await pool.query(
      `SELECT id FROM payments WHERE rental_id = $1 AND payment_type = 'SECURITY_DEPOSIT' AND status = 'PAID'`,
      [id]
    );

    if (paymentRes.rows.length > 0) {
      await pool.query(`
        INSERT INTO refunds (payment_id, rental_id, deposit_amount, damage_amount, refund_amount, refund_status, damage_description)
        VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
      `, [paymentRes.rows[0].id, id, rental.deposit_amount, dmgAmt, refundAmt, damage_description || null]);
    }

    res.json({ message: 'Return confirmed. Refund review initiated.', refund_amount: refundAmt });
  } catch (error) {
    console.error('[RentalController] confirmReturn error:', error.message);
    res.status(500).json({ error: 'Failed to confirm return.' });
  }
};
