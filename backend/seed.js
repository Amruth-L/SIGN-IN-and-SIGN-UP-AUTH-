const pool = require('./config/db');
const bcrypt = require('bcrypt');

const dummyUsers = [
  { name: 'Amruth L', email: '1DB23AD001@dbit.co.in', phone_number: '+919876543201' },
  { name: 'Rahul Kumar', email: '1DB23AD002@dbit.co.in', phone_number: '+919876543202' },
  { name: 'Priya Sharma', email: '1DB23AD003@dbit.co.in', phone_number: '+919876543203' },
  { name: 'Kiran R', email: '1DB23AD004@dbit.co.in', phone_number: '+919876543204' },
  { name: 'Sneha Patel', email: '1DB23AD005@dbit.co.in', phone_number: '+919876543205' },
  { name: 'Arjun Nair', email: '1DB23AD006@dbit.co.in', phone_number: '+919876543206' },
  { name: 'Pooja Singh', email: '1DB23AD007@dbit.co.in', phone_number: '+919876543207' },
  { name: 'Vivek Rao', email: '1DB23AD008@dbit.co.in', phone_number: '+919876543208' },
  { name: 'Neha Gupta', email: '1DB23AD009@dbit.co.in', phone_number: '+919876543209' },
  { name: 'Rohit Verma', email: '1DB23AD010@dbit.co.in', phone_number: '+919876543210' },
];

const seedDatabase = async () => {
  try {
    console.log('Starting database setup...');

    // Drop existing tables in reverse dependency order
    await pool.query('DROP TABLE IF EXISTS delivery_requests CASCADE');
    await pool.query('DROP TABLE IF EXISTS refunds CASCADE');
    await pool.query('DROP TABLE IF EXISTS payments CASCADE');
    await pool.query('DROP TABLE IF EXISTS pending_orders CASCADE');
    await pool.query('DROP TABLE IF EXISTS cart CASCADE');
    await pool.query('DROP TABLE IF EXISTS rentals CASCADE');
    await pool.query('DROP TABLE IF EXISTS listings CASCADE');
    await pool.query('DROP TABLE IF EXISTS otps CASCADE');
    await pool.query('DROP TABLE IF EXISTS system_config CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    
    // 1. Create Users Table
    await pool.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        username VARCHAR(100) UNIQUE,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        phone_number VARCHAR(20),
        avatar_url TEXT,
        bio TEXT,
        department VARCHAR(255),
        hostel VARCHAR(255),
        email_verified BOOLEAN DEFAULT FALSE,
        otp VARCHAR(6),
        otp_expiry TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Users table ready.');

    // 2. Create Listings Table
    await pool.query(`
      CREATE TABLE listings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        category VARCHAR(255) NOT NULL,
        image_url TEXT,
        owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
        condition VARCHAR(50) DEFAULT 'Good',
        rent_price DECIMAL(10, 2) DEFAULT 0,
        deposit DECIMAL(10, 2) DEFAULT 0,
        location VARCHAR(255) DEFAULT 'Library',
        delivery_available BOOLEAN DEFAULT FALSE,
        delivery_charge DECIMAL(10, 2) DEFAULT 0,
        pickup_time VARCHAR(100) DEFAULT '5 min',
        image_urls TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Listings table ready.');

    // 3. Create system_config Table (configurable business rules)
    await pool.query(`
      CREATE TABLE system_config (
        key VARCHAR(100) PRIMARY KEY,
        value VARCHAR(255) NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('system_config table ready.');

    // 4. Create rentals Table
    await pool.query(`
      CREATE TABLE rentals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
        borrower_id UUID REFERENCES users(id) ON DELETE CASCADE,
        owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        rental_days INTEGER NOT NULL,
        rental_fee DECIMAL(10, 2) NOT NULL,
        delivery_fee DECIMAL(10, 2) DEFAULT 0,
        platform_fee DECIMAL(10, 2) DEFAULT 0,
        booking_amount DECIMAL(10, 2) NOT NULL,
        deposit_amount DECIMAL(10, 2) DEFAULT 0,
        status VARCHAR(60) DEFAULT 'BOOKING_REQUESTED',
        booking_status VARCHAR(60) DEFAULT 'PENDING',
        deposit_status VARCHAR(60) DEFAULT 'PENDING',
        payment_status VARCHAR(60) DEFAULT 'PENDING',
        owner_response VARCHAR(20) DEFAULT 'PENDING',
        owner_responded_at TIMESTAMP,
        deposit_deadline TIMESTAMP,
        qr_code_hash VARCHAR(255),
        qr_generated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('rentals table ready.');

    // 5. Create payments Table
    await pool.query(`
      CREATE TABLE payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID,
        rental_id UUID REFERENCES rentals(id) ON DELETE CASCADE,
        payment_type VARCHAR(50) NOT NULL DEFAULT 'RENTAL',
        amount DECIMAL(10, 2) NOT NULL,
        gateway VARCHAR(50) DEFAULT 'razorpay',
        payment_gateway VARCHAR(50) DEFAULT 'razorpay',
        gateway_order_id VARCHAR(255),
        gateway_payment_id VARCHAR(255),
        gateway_signature VARCHAR(512),
        transaction_id VARCHAR(255),
        status VARCHAR(30) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('payments table ready.');

    // 6. Create refunds Table
    await pool.query(`
      CREATE TABLE refunds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
        rental_id UUID REFERENCES rentals(id) ON DELETE CASCADE,
        deposit_amount DECIMAL(10, 2) NOT NULL,
        damage_amount DECIMAL(10, 2) DEFAULT 0,
        refund_amount DECIMAL(10, 2) NOT NULL,
        refund_status VARCHAR(30) DEFAULT 'PENDING',
        damage_description TEXT,
        approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        remarks TEXT,
        gateway_refund_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('refunds table ready.');

    // 7. Create cart Table
    await pool.query(`
      CREATE TABLE cart (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        item_id UUID REFERENCES listings(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days INTEGER NOT NULL,
        price_per_day DECIMAL(10, 2) NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        delivery_charge DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, item_id)
      );
    `);
    console.log('cart table ready.');

    // 8. Create pending_orders Table (for cart checkout caching)
    await pool.query(`
      CREATE TABLE pending_orders (
        id VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        booking_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('pending_orders table ready.');

    // 9. Create wishlist Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wishlist (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        item_id UUID REFERENCES listings(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, item_id)
      );
    `);
    console.log('wishlist table ready.');

    // 10. Create delivery_requests Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rental_id UUID REFERENCES rentals(id) ON DELETE CASCADE,
        listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
        customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
        seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
        courier_id UUID REFERENCES users(id) ON DELETE SET NULL,
        pickup_location VARCHAR(255) NOT NULL,
        drop_location VARCHAR(255) NOT NULL DEFAULT 'Campus',
        distance DECIMAL(5,2) DEFAULT 1.0,
        estimated_time VARCHAR(100) DEFAULT '10 mins',
        delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        courier_earning DECIMAL(10,2) NOT NULL DEFAULT 0,
        status VARCHAR(50) DEFAULT 'AVAILABLE',
        pickup_token VARCHAR(255),
        delivery_token VARCHAR(255),
        declined_by UUID[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        accepted_at TIMESTAMP,
        picked_up_at TIMESTAMP,
        delivered_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('delivery_requests table ready.');

    // Seed system_config defaults
    await pool.query(`
      INSERT INTO system_config (key, value, description) VALUES
        ('platform_fee_fixed', '5', 'Fixed platform fee per booking in INR'),
        ('deposit_timeout_minutes', '30', 'Minutes borrower has to pay deposit after owner accepts'),
        ('default_delivery_charge', '10', 'Default delivery charge if not set by owner'),
        ('min_rental_days', '1', 'Minimum rental duration in days'),
        ('max_rental_days', '30', 'Maximum rental duration in days')
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log('system_config seeded.');

    // 7. Seed Users
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = 'Password@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    let insertedCount = 0;
    for (const user of dummyUsers) {
      try {
        const username = user.name.toLowerCase().replace(/\s+/g, '_');
        await pool.query(
          'INSERT INTO users (name, username, email, password, phone_number, email_verified) VALUES ($1, $2, $3, $4, $5, $6)',
          [user.name, username, user.email, hashedPassword, user.phone_number, true]
        );
        insertedCount++;
      } catch (err) {
        if (err.code === '23505') {
          // Unique violation (duplicate email), skip
          console.log(`User ${user.email} already exists. Skipping.`);
        } else {
          console.error(`Error inserting user ${user.email}:`, err);
        }
      }
    }

    console.log(`Database seeded successfully! Inserted ${insertedCount} new users.`);

    // 4. Seed Listings
    console.log('Seeding listings...');
    const usersRes = await pool.query('SELECT id FROM users');
    const userIds = usersRes.rows.map(row => row.id);

    if (userIds.length > 0) {
      const dummyListings = [
        // ================= BOOKS =================
        {
          title: 'Core Java Volume I (Fundamentals)',
          description: 'Essential for CS students. Comprehensive guide to Java. Almost brand new.',
          price: 350,
          category: 'Books',
          image_url: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500&auto=format&fit=crop&q=60',
          condition: 'Like New',
          rent_price: 15,
          deposit: 100,
          location: 'Central Library',
          delivery_available: true,
          delivery_charge: 10,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Introduction to Algorithms (CLRS)',
          description: 'The bible of DSA. 3rd Edition. Covers all algorithms for competitive programming and placements.',
          price: 500,
          category: 'Books',
          image_url: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=500&auto=format&fit=crop&q=60',
          condition: 'Good',
          rent_price: 20,
          deposit: 150,
          location: 'Central Library',
          delivery_available: true,
          delivery_charge: 10,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1532012197267-da84d127e765?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Engineering Mathematics by B.S. Grewal',
          description: 'Covers all 4 semesters of engineering math. Well-maintained with no markings.',
          price: 280,
          category: 'Books',
          image_url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=500&auto=format&fit=crop&q=60',
          condition: 'Good',
          rent_price: 12,
          deposit: 80,
          location: 'Boys Hostel',
          delivery_available: false,
          delivery_charge: 0,
          pickup_time: '10 min',
          image_urls: ['https://images.unsplash.com/photo-1509228468518-180dd4864904?w=500&auto=format&fit=crop&q=60']
        },

        // ================= ELECTRONICS =================
        {
          title: 'MacBook Pro 15-inch (Mid 2018)',
          description: '16GB RAM, 512GB SSD, Touchbar. Runs Xcode, Android Studio and VS Code perfectly.',
          price: 38000,
          category: 'Electronics',
          image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&auto=format&fit=crop&q=60',
          condition: 'Excellent',
          rent_price: 300,
          deposit: 5000,
          location: 'AI & DS Block',
          delivery_available: true,
          delivery_charge: 50,
          pickup_time: '15 min',
          image_urls: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'iPad Air 5th Gen with Apple Pencil',
          description: 'Perfect for note-taking with Notability/GoodNotes. 64GB WiFi model, M1 chip. Comes with pencil and case.',
          price: 28000,
          category: 'Electronics',
          image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&auto=format&fit=crop&q=60',
          condition: 'Like New',
          rent_price: 200,
          deposit: 3000,
          location: 'Girls Hostel',
          delivery_available: true,
          delivery_charge: 30,
          pickup_time: '10 min',
          image_urls: ['https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Razer BlackWidow V3 Mechanical Keyboard',
          description: 'Green switches, full RGB, USB passthrough. Great for coding marathons and gaming.',
          price: 4500,
          category: 'Electronics',
          image_url: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=500&auto=format&fit=crop&q=60',
          condition: 'Excellent',
          rent_price: 50,
          deposit: 500,
          location: 'Boys Hostel',
          delivery_available: true,
          delivery_charge: 15,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'JBL Charge 5 Bluetooth Speaker',
          description: 'Powerful bass, IP67 waterproof, 20-hour battery life. Great for hostel room parties.',
          price: 8000,
          category: 'Electronics',
          image_url: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&auto=format&fit=crop&q=60',
          condition: 'Good',
          rent_price: 80,
          deposit: 1000,
          location: 'Central Library',
          delivery_available: true,
          delivery_charge: 20,
          pickup_time: '10 min',
          image_urls: ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Arduino Uno R3 Starter Kit',
          description: 'Complete starter kit with breadboard, jumper wires, sensors, LEDs, resistors, and servo motor. Perfect for IoT projects.',
          price: 1200,
          category: 'Electronics',
          image_url: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?w=500&auto=format&fit=crop&q=60',
          condition: 'Good',
          rent_price: 30,
          deposit: 300,
          location: 'ECE Lab',
          delivery_available: false,
          delivery_charge: 0,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1553406830-ef2513450d76?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Raspberry Pi 4 Model B (4GB)',
          description: 'With case, power supply, SD card (32GB), and heatsinks. Loaded with Raspbian OS. Great for mini-projects.',
          price: 3500,
          category: 'Electronics',
          image_url: 'https://images.unsplash.com/photo-1629292942419-6fe76f3bfd41?w=500&auto=format&fit=crop&q=60',
          condition: 'Excellent',
          rent_price: 40,
          deposit: 500,
          location: 'CS Block',
          delivery_available: true,
          delivery_charge: 15,
          pickup_time: '10 min',
          image_urls: ['https://images.unsplash.com/photo-1629292942419-6fe76f3bfd41?w=500&auto=format&fit=crop&q=60']
        },

        // ================= STATIONERY =================
        {
          title: 'Drafting Board (Half Imperial)',
          description: 'Used for first-year engineering drawing lab. Comes with wooden board, clips, and carry case.',
          price: 500,
          category: 'Stationery',
          image_url: 'https://images.unsplash.com/photo-1452830978618-d6feae7d0ffa?w=500&auto=format&fit=crop&q=60',
          condition: 'Good',
          rent_price: 10,
          deposit: 150,
          location: 'Boys Hostel',
          delivery_available: false,
          delivery_charge: 0,
          pickup_time: '10 min',
          image_urls: ['https://images.unsplash.com/photo-1452830978618-d6feae7d0ffa?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Casio FX-991EX Scientific Calculator',
          description: 'Advanced scientific calculator with spreadsheet function. Allowed in exams. Batteries included.',
          price: 1200,
          category: 'Stationery',
          image_url: 'https://images.unsplash.com/photo-1564466809058-bf4114d55352?w=500&auto=format&fit=crop&q=60',
          condition: 'Excellent',
          rent_price: 15,
          deposit: 200,
          location: 'Central Library',
          delivery_available: true,
          delivery_charge: 5,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1564466809058-bf4114d55352?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Rotring Rapid Pro Technical Pencil Set',
          description: 'Professional drafting pencils (0.5mm, 0.7mm) with leads, erasers, and stencils. Perfect for drawing lab.',
          price: 800,
          category: 'Stationery',
          image_url: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=500&auto=format&fit=crop&q=60',
          condition: 'Like New',
          rent_price: 10,
          deposit: 100,
          location: 'Girls Hostel',
          delivery_available: true,
          delivery_charge: 5,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=500&auto=format&fit=crop&q=60']
        },

        // ================= LAB EQUIPMENT =================
        {
          title: 'Chemistry Lab Coat (XL Size)',
          description: 'White thick cotton lab coat. Cleaned and ironed. Mandatory for first-year lab practicals.',
          price: 200,
          category: 'Lab Equipment',
          image_url: 'https://images.unsplash.com/photo-1581093518717-d57b51bb93c8?w=500&auto=format&fit=crop&q=60',
          condition: 'Good',
          rent_price: 5,
          deposit: 50,
          location: 'Girls Hostel',
          delivery_available: true,
          delivery_charge: 10,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1581093518717-d57b51bb93c8?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Digital Multimeter (Fluke 117)',
          description: 'True RMS multimeter for circuit lab experiments. Measures voltage, current, resistance, capacitance.',
          price: 2500,
          category: 'Lab Equipment',
          image_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60',
          condition: 'Excellent',
          rent_price: 25,
          deposit: 400,
          location: 'ECE Lab',
          delivery_available: false,
          delivery_charge: 0,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Soldering Iron Kit with Stand',
          description: 'Adjustable temperature soldering station with flux, solder wire, desoldering pump, and tips. For PCB projects.',
          price: 900,
          category: 'Lab Equipment',
          image_url: 'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=500&auto=format&fit=crop&q=60',
          condition: 'Good',
          rent_price: 15,
          deposit: 200,
          location: 'Maker Lab',
          delivery_available: true,
          delivery_charge: 10,
          pickup_time: '10 min',
          image_urls: ['https://images.unsplash.com/photo-1588508065123-287b28e013da?w=500&auto=format&fit=crop&q=60']
        },

        // ================= GAMING =================
        {
          title: 'PS5 DualSense Controller',
          description: 'Wireless controller with haptic feedback and adaptive triggers. Works with PC too via USB-C.',
          price: 4000,
          category: 'Gaming',
          image_url: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=500&auto=format&fit=crop&q=60',
          condition: 'Like New',
          rent_price: 50,
          deposit: 500,
          location: 'Boys Hostel',
          delivery_available: true,
          delivery_charge: 10,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Nintendo Switch Lite (Grey)',
          description: 'Portable console with 3 games: Zelda BOTW, Mario Kart, Animal Crossing. Charger and case included.',
          price: 12000,
          category: 'Gaming',
          image_url: 'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=500&auto=format&fit=crop&q=60',
          condition: 'Excellent',
          rent_price: 100,
          deposit: 2000,
          location: 'AI & DS Block',
          delivery_available: true,
          delivery_charge: 20,
          pickup_time: '10 min',
          image_urls: ['https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Logitech G502 Hero Gaming Mouse',
          description: '25K DPI sensor, 11 programmable buttons, adjustable weights. Best mouse for gaming and CAD work.',
          price: 2800,
          category: 'Gaming',
          image_url: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=60',
          condition: 'Good',
          rent_price: 30,
          deposit: 400,
          location: 'Boys Hostel',
          delivery_available: true,
          delivery_charge: 10,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=60']
        },

        // ================= SPORTS =================
        {
          title: 'Yonex Nanoray Light 18i Badminton Racket',
          description: 'Lightweight isometric frame, strung with BG65 at 24lbs. Comes with full cover. Great for recreational play.',
          price: 1500,
          category: 'Sports',
          image_url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=500&auto=format&fit=crop&q=60',
          condition: 'Excellent',
          rent_price: 20,
          deposit: 300,
          location: 'Sports Complex',
          delivery_available: false,
          delivery_charge: 0,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Nivia Storm Football (Size 5)',
          description: 'FIFA quality match ball. Hand stitched, good grip. Used only 3 times on turf.',
          price: 600,
          category: 'Sports',
          image_url: 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=500&auto=format&fit=crop&q=60',
          condition: 'Like New',
          rent_price: 10,
          deposit: 100,
          location: 'Sports Complex',
          delivery_available: true,
          delivery_charge: 10,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Yoga Mat (6mm Anti-Slip)',
          description: 'NBR foam yoga mat with carry strap. Used for morning yoga sessions. Cleaned and sanitized.',
          price: 400,
          category: 'Sports',
          image_url: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500&auto=format&fit=crop&q=60',
          condition: 'Good',
          rent_price: 5,
          deposit: 50,
          location: 'Girls Hostel',
          delivery_available: true,
          delivery_charge: 5,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500&auto=format&fit=crop&q=60']
        },

        // ================= MUSICAL INSTRUMENTS =================
        {
          title: 'Yamaha F280 Acoustic Guitar',
          description: 'Full-size dreadnought guitar with spruce top. Includes capo, pick set, and padded gig bag.',
          price: 5000,
          category: 'Musical Instruments',
          image_url: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop&q=60',
          condition: 'Good',
          rent_price: 60,
          deposit: 800,
          location: 'Boys Hostel',
          delivery_available: false,
          delivery_charge: 0,
          pickup_time: '10 min',
          image_urls: ['https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Casio CTK-3500 Keyboard (61 Keys)',
          description: 'Portable keyboard with touch-sensitive keys, 400 tones, and USB connectivity. Great for learning piano.',
          price: 6000,
          category: 'Musical Instruments',
          image_url: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=500&auto=format&fit=crop&q=60',
          condition: 'Excellent',
          rent_price: 70,
          deposit: 1000,
          location: 'Music Room',
          delivery_available: true,
          delivery_charge: 30,
          pickup_time: '15 min',
          image_urls: ['https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=500&auto=format&fit=crop&q=60']
        },

        // ================= PHOTOGRAPHY =================
        {
          title: 'Canon EOS 200D II DSLR Camera',
          description: '24.1 MP, with 18-55mm kit lens. Perfect for college events, fests, and photography club. Comes with bag and SD card.',
          price: 25000,
          category: 'Photography',
          image_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500&auto=format&fit=crop&q=60',
          condition: 'Excellent',
          rent_price: 250,
          deposit: 3000,
          location: 'Central Library',
          delivery_available: true,
          delivery_charge: 40,
          pickup_time: '10 min',
          image_urls: ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Godox Ring Light (18 inch)',
          description: '3-color temperature modes with phone holder and tripod stand. Must-have for video presentations and reels.',
          price: 2000,
          category: 'Photography',
          image_url: 'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=500&auto=format&fit=crop&q=60',
          condition: 'Like New',
          rent_price: 25,
          deposit: 300,
          location: 'Girls Hostel',
          delivery_available: true,
          delivery_charge: 15,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=500&auto=format&fit=crop&q=60']
        },

        // ================= STUDY AIDS =================
        {
          title: 'Sony WH-1000XM4 Noise Cancelling Headphones',
          description: '30-hour battery, LDAC, ANC. Perfect for studying in noisy hostel environments. Comes with case.',
          price: 15000,
          category: 'Study Aids',
          image_url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500&auto=format&fit=crop&q=60',
          condition: 'Excellent',
          rent_price: 100,
          deposit: 2000,
          location: 'Central Library',
          delivery_available: true,
          delivery_charge: 20,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Portable Whiteboard (2x3 ft)',
          description: 'Magnetic dry-erase whiteboard with markers and duster. Great for group study sessions and DSA practice.',
          price: 700,
          category: 'Study Aids',
          image_url: 'https://images.unsplash.com/photo-1532619675605-1ede6c2ed2b0?w=500&auto=format&fit=crop&q=60',
          condition: 'Good',
          rent_price: 10,
          deposit: 100,
          location: 'Boys Hostel',
          delivery_available: false,
          delivery_charge: 0,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1532619675605-1ede6c2ed2b0?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Dell 24-inch Monitor (P2422H)',
          description: 'Full HD IPS display, USB-C hub, adjustable stand. Ideal for dual-screen coding or project presentations.',
          price: 12000,
          category: 'Study Aids',
          image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=60',
          condition: 'Excellent',
          rent_price: 120,
          deposit: 2000,
          location: 'CS Block',
          delivery_available: true,
          delivery_charge: 50,
          pickup_time: '15 min',
          image_urls: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=60']
        },

        // ================= TRANSPORT =================
        {
          title: 'Firefox Roadrunner Pro Bicycle',
          description: '21-speed gear cycle with front suspension. Great for commuting between campus buildings and hostel.',
          price: 8000,
          category: 'Transport',
          image_url: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=500&auto=format&fit=crop&q=60',
          condition: 'Good',
          rent_price: 50,
          deposit: 1000,
          location: 'Parking Area',
          delivery_available: false,
          delivery_charge: 0,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=500&auto=format&fit=crop&q=60']
        },
        {
          title: 'Ninebot E25 Electric Scooter',
          description: 'Foldable e-scooter, 25km range, 25 km/h top speed. Charged and ready. Helmet included.',
          price: 18000,
          category: 'Transport',
          image_url: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=500&auto=format&fit=crop&q=60',
          condition: 'Like New',
          rent_price: 150,
          deposit: 2500,
          location: 'Main Gate',
          delivery_available: false,
          delivery_charge: 0,
          pickup_time: '5 min',
          image_urls: ['https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=500&auto=format&fit=crop&q=60']
        }
      ];

      for (let i = 0; i < dummyListings.length; i++) {
        const item = dummyListings[i];
        const ownerId = userIds[i % userIds.length];
        await pool.query(`
          INSERT INTO listings (
            title, description, price, category, image_url, owner_id,
            condition, rent_price, deposit, location, delivery_available, delivery_charge, pickup_time, image_urls
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          item.title, item.description, item.price, item.category, item.image_url, ownerId,
          item.condition, item.rent_price, item.deposit, item.location, item.delivery_available, item.delivery_charge, item.pickup_time, item.image_urls
        ]);
      }
      console.log('Listings seeded successfully!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
