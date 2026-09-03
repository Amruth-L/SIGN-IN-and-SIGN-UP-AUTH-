const pool = require('../../config/database');
const { matchDelivery } = require('../delivery/matching.service');
const { emitUser } = require('../../shared/realtime');

// Helper: get system config value
const getConfig = async (key) => {
  const result = await pool.query('SELECT value FROM system_config WHERE key = $1', [key]);
  return result.rows[0]?.value || null;
};

// POST /api/rentals/book
exports.bookRental = async (req, res) => {
  const borrower_id = req.user.id;
  const { listing_id, start_date, end_date, delivery_requested = false, drop_location_id = null } = req.body;

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
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      return res.status(400).json({ error: 'start_date cannot be in the past.' });
    }
    if (end < start) {
      return res.status(400).json({ error: 'end_date cannot be before start_date.' });
    }
    if (delivery_requested && (!listing.delivery_available || !drop_location_id)) {
      return res.status(400).json({ error: 'Choose an available campus drop location for delivery.' });
    }

    const rental_days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const { calculatePricing } = require('../../shared/pricing-engine');
    const pricing = calculatePricing({
      dailyRent: listing.rent_price || listing.price || 0,
      days: rental_days,
      deliveryType: delivery_requested ? 'STANDARD' : 'SELF_PICKUP',
      ownerLocation: listing.location || '',
      itemValue: listing.price || 0,
      customDeposit: listing.deposit,
    });

    const rental_fee = pricing.rentalFee;
    const delivery_fee = pricing.deliveryFee;
    const platform_fee = pricing.platformFee;
    const booking_amount = pricing.totalAmount;
    const deposit_amount = pricing.securityDeposit;

    // Check if active rental already exists for this listing & dates
    const conflictRes = await pool.query(
      `
      SELECT id FROM rentals
      WHERE listing_id = $1
        AND status NOT IN ('BOOKING_PAYMENT_PENDING', 'CANCELLED', 'COMPLETED', 'DEPOSIT_REFUNDED')
        AND NOT (end_date < $2 OR start_date > $3)
    `,
      [listing_id, start_date, end_date],
    );

    if (conflictRes.rows.length > 0) {
      return res.status(409).json({ error: 'These rental dates conflict with an existing booking.' });
    }

    // Create rental record
    const rentalRes = await pool.query(
      `
      INSERT INTO rentals (
        listing_id, borrower_id, owner_id, start_date, end_date, rental_days,
        rental_fee, delivery_fee, platform_fee, booking_amount, deposit_amount,
        status, booking_status, deposit_status, payment_status, owner_response, delivery_requested, drop_location_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        'BOOKING_PAYMENT_PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING', $12, $13)
      RETURNING *
    `,
      [
        listing_id,
        borrower_id,
        listing.owner_id,
        start_date,
        end_date,
        rental_days,
        rental_fee,
        delivery_fee,
        platform_fee,
        booking_amount,
        deposit_amount,
        Boolean(delivery_requested),
        drop_location_id,
      ],
    );

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
        rental_days,
      },
      listing: {
        title: listing.title,
        image_url: listing.image_url,
        category: listing.category,
        condition: listing.condition,
        location: listing.location,
      },
    });
  } catch (error) {
    console.error('[RentalController] bookRental error:', error.message);
    res.status(500).json({ error: 'Failed to create rental booking.' });
  }
};

// POST /api/rentals/respond
exports.respondToBooking = async (req, res) => {
  const owner_id = req.user.id;
  const { rental_id, response } = req.body;

  if (!rental_id || !['ACCEPTED', 'REJECTED'].includes(response)) {
    return res.status(400).json({ error: 'rental_id and response (ACCEPTED or REJECTED) are required.' });
  }

  try {
    const rentalRes = await pool.query('SELECT * FROM rentals WHERE id = $1', [rental_id]);
    if (rentalRes.rows.length === 0) {
      return res.status(404).json({ error: 'Rental not found.' });
    }
    const rental = rentalRes.rows[0];

    if (rental.owner_id !== owner_id) {
      return res
        .status(403)
        .json({ error: 'Forbidden: Only the listing owner can respond to this booking.' });
    }

    if (rental.status !== 'OWNER_PENDING' && rental.status !== 'RENTAL_PAYMENT_COMPLETED') {
      return res.status(400).json({ error: `Cannot respond: rental is in status "${rental.status}".` });
    }

    if (response === 'REJECTED') {
      await pool.query(
        `
        UPDATE rentals SET
          status = 'CANCELLED',
          booking_status = 'CANCELLED',
          owner_response = 'REJECTED',
          owner_responded_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `,
        [rental_id],
      );

      console.log(`[RentalController] Owner rejected rental ${rental_id}`);
      return res.json({
        message: 'Booking rejected. Refund will be processed per platform policy.',
        status: 'CANCELLED',
      });
    }

    // Owner ACCEPTED — calculate deposit deadline
    const depositTimeoutMins = parseInt((await getConfig('deposit_timeout_minutes')) || '30');
    const deposit_deadline = new Date(Date.now() + depositTimeoutMins * 60 * 1000);

    await pool.query(
      `
      UPDATE rentals SET
        status = 'DEPOSIT_PENDING',
        booking_status = 'CONFIRMED',
        owner_response = 'ACCEPTED',
        owner_responded_at = NOW(),
        deposit_deadline = $1,
        updated_at = NOW()
      WHERE id = $2
    `,
      [deposit_deadline, rental_id],
    );

    console.log(
      `[RentalController] Owner accepted rental ${rental_id}. Deposit deadline: ${deposit_deadline}`,
    );

    let delivery = null;
    if (rental.delivery_requested || Number(rental.delivery_fee) > 0) {
      const details = await pool.query(
        `SELECT r.*, l.title, l.location, l.pickup_location_id,
        l.pickup_location_id resolved_pickup,
        r.drop_location_id resolved_drop
        FROM rentals r JOIN listings l ON l.id=r.listing_id WHERE r.id=$1`,
        [rental_id],
      );
      const row = details.rows[0];
      if (!row?.resolved_pickup || !row?.resolved_drop) {
        return res.status(422).json({ error: 'Pickup and drop-off must be explicit campus locations.' });
      }
      if (row.resolved_pickup && row.resolved_drop) {
        const locations = await pool.query('SELECT * FROM campus_locations WHERE id=ANY($1)', [
          [row.resolved_pickup, row.resolved_drop],
        ]);
        const byId = Object.fromEntries(locations.rows.map((item) => [item.id, item]));
        if (!byId[row.resolved_pickup] || !byId[row.resolved_drop]) {
          return res.status(422).json({ error: 'The selected campus locations are no longer available.' });
        }
        const label = (item) =>
          [item.building_name, item.floor_name, item.room_name].filter(Boolean).join(' · ');
        const existing = await pool.query(
          "SELECT id FROM delivery_requests WHERE rental_id=$1 AND task_type='RENTAL_OUTBOUND' ORDER BY created_at DESC LIMIT 1",
          [rental_id],
        );
        if (existing.rows[0]) {
          const updated = await pool.query(
            `UPDATE delivery_requests SET pickup_location_id=$1,destination_location_id=$2,
            pickup_location=$3,drop_location=$4,status='WAITING_FOR_DEPOSIT',updated_at=NOW() WHERE id=$5 RETURNING *`,
            [
              row.resolved_pickup,
              row.resolved_drop,
              label(byId[row.resolved_pickup]),
              label(byId[row.resolved_drop]),
              existing.rows[0].id,
            ],
          );
          delivery = updated.rows[0];
        } else {
          const created = await pool.query(
            `INSERT INTO delivery_requests (rental_id,listing_id,customer_id,seller_id,pickup_location,drop_location,
            pickup_location_id,destination_location_id,task_type,item_description,delivery_fee,courier_earning,status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'RENTAL_OUTBOUND',$9,$10,$11,'WAITING_FOR_DEPOSIT') RETURNING *`,
            [
              rental_id,
              row.listing_id,
              row.borrower_id,
              row.owner_id,
              label(byId[row.resolved_pickup]),
              label(byId[row.resolved_drop]),
              row.resolved_pickup,
              row.resolved_drop,
              row.title,
              row.delivery_fee,
              Number(row.delivery_fee) * 0.7,
            ],
          );
          delivery = created.rows[0];
        }
        await pool.query(
          "UPDATE rentals SET status='DEPOSIT_PENDING', outbound_delivery_id=$1 WHERE id=$2",
          [delivery.id, rental_id],
        );
        const deliveryEvent = { rental_id: rental_id, delivery_id: delivery.id, status: delivery.status };
        emitUser(rental.borrower_id, 'delivery:created', deliveryEvent);
        emitUser(rental.owner_id, 'delivery:created', deliveryEvent);
      }
    }
    res.json({
      message: 'Booking accepted. Borrower must pay security deposit before deadline.',
      status: 'DEPOSIT_PENDING',
      deposit_deadline,
      deposit_amount: rental.deposit_amount,
      deposit_timeout_minutes: depositTimeoutMins,
    });
  } catch (error) {
    console.error('[RentalController] respondToBooking error:', error.message);
    res.status(500).json({ error: 'Failed to respond to booking.' });
  }
};

exports.requestReturn = async (req, res) => {
  const rentalResult = await pool.query(
    `SELECT r.*, l.title, l.pickup_location_id,
    r.drop_location_id borrower_location
    FROM rentals r JOIN listings l ON l.id=r.listing_id WHERE r.id=$1`,
    [req.params.id],
  );
  const rental = rentalResult.rows[0];
  if (!rental) return res.status(404).json({ error: 'Rental not found.' });
  if (rental.borrower_id !== req.user.id)
    return res.status(403).json({ error: 'Only the borrower can request a return.' });
  if (rental.status !== 'RENTAL_ACTIVE')
    return res.status(409).json({ error: 'The rental must be active before a return can be requested.' });
  if (!rental.borrower_location || !rental.pickup_location_id)
    return res.status(422).json({ error: 'Both return locations must be configured.' });
  const locs = await pool.query('SELECT * FROM campus_locations WHERE id=ANY($1)', [
    [rental.borrower_location, rental.pickup_location_id],
  ]);
  const byId = Object.fromEntries(locs.rows.map((x) => [x.id, x]));
  const label = (x) => [x.building_name, x.floor_name, x.room_name].filter(Boolean).join(' · ');
  const { rows } = await pool.query(
    `INSERT INTO delivery_requests (rental_id,listing_id,customer_id,seller_id,pickup_location,drop_location,
    pickup_location_id,destination_location_id,task_type,item_description,delivery_fee,courier_earning,status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'RENTAL_RETURN',$9,$10,$11,'RETURN_MATCHING') RETURNING *`,
    [
      rental.id,
      rental.listing_id,
      rental.owner_id,
      rental.borrower_id,
      label(byId[rental.borrower_location]),
      label(byId[rental.pickup_location_id]),
      rental.borrower_location,
      rental.pickup_location_id,
      `Return: ${rental.title}`,
      rental.delivery_fee,
      Number(rental.delivery_fee) * 0.7,
    ],
  );
  await pool.query(
    "UPDATE rentals SET status='RETURN_MATCHING',return_delivery_id=$1,updated_at=NOW() WHERE id=$2",
    [rows[0].id, rental.id],
  );
  await matchDelivery(rows[0].id);
  res.status(201).json(rows[0]);
};

exports.getHistory = async (req, res) => {
  const rental = await pool.query('SELECT * FROM rentals WHERE id=$1 AND (borrower_id=$2 OR owner_id=$2)', [
    req.params.id,
    req.user.id,
  ]);
  if (!rental.rows[0]) return res.status(404).json({ error: 'Rental not found.' });
  const { rows } = await pool.query(
    'SELECT * FROM transaction_events WHERE rental_id=$1 ORDER BY created_at',
    [req.params.id],
  );
  res.json(rows);
};

// GET /api/rentals/:id/status
exports.getRentalStatus = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(404).json({ error: 'Rental not found.' });
  }

  try {
    const rentalRes = await pool.query(
      `
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
    `,
      [id],
    );

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
      deposit_seconds_remaining = Math.max(
        0,
        Math.floor((new Date(rental.deposit_deadline) - Date.now()) / 1000),
      );

      // Auto-cancel if timer expired
      if (deposit_seconds_remaining <= 0) {
        await pool.query(
          `
          UPDATE rentals SET status = 'CANCELLED', deposit_status = 'TIMEOUT', updated_at = NOW()
          WHERE id = $1 AND status = 'DEPOSIT_PENDING'
        `,
          [id],
        );
        rental.status = 'CANCELLED';
        rental.deposit_status = 'TIMEOUT';
      }
    }

    // Fetch related payments
    const paymentsRes = await pool.query(
      'SELECT id, payment_type, amount, status, created_at FROM payments WHERE rental_id = $1 ORDER BY created_at ASC',
      [id],
    );

    res.json({
      rental,
      payments: paymentsRes.rows,
      deposit_seconds_remaining,
      qr_available: rental.status === 'QR_GENERATED' && !!rental.qr_code_hash,
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
    const res_ = await pool.query(
      `
      SELECT r.*, COALESCE(r.outbound_delivery_id, r.return_delivery_id) AS delivery_id,
        l.title as listing_title, l.image_url as listing_image, l.category as listing_category,
        ou.name as owner_name
      FROM rentals r
      LEFT JOIN listings l ON r.listing_id = l.id
      LEFT JOIN users ou ON r.owner_id = ou.id
      WHERE r.borrower_id = $1
      ORDER BY r.created_at DESC
    `,
      [user_id],
    );
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
    const res_ = await pool.query(
      `
      SELECT r.*,
        l.title as listing_title, l.image_url as listing_image, l.category as listing_category,
        bu.name as borrower_name, bu.email as borrower_email
      FROM rentals r
      LEFT JOIN listings l ON r.listing_id = l.id
      LEFT JOIN users bu ON r.borrower_id = bu.id
      WHERE r.owner_id = $1
      ORDER BY r.created_at DESC
    `,
      [owner_id],
    );
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

    await pool.query(
      `
      UPDATE rentals SET status = 'OWNER_INSPECTION', updated_at = NOW() WHERE id = $1
    `,
      [id],
    );

    // Find the deposit payment
    const paymentRes = await pool.query(
      `SELECT id FROM payments WHERE rental_id = $1 AND payment_type = 'SECURITY_DEPOSIT' AND status = 'PAID'`,
      [id],
    );

    if (paymentRes.rows.length > 0) {
      await pool.query(
        `
        INSERT INTO refunds (payment_id, rental_id, deposit_amount, damage_amount, refund_amount, refund_status, damage_description)
        VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
      `,
        [paymentRes.rows[0].id, id, rental.deposit_amount, dmgAmt, refundAmt, damage_description || null],
      );
    }

    res.json({ message: 'Return confirmed. Refund review initiated.', refund_amount: refundAmt });
  } catch (error) {
    console.error('[RentalController] confirmReturn error:', error.message);
    res.status(500).json({ error: 'Failed to confirm return.' });
  }
};

