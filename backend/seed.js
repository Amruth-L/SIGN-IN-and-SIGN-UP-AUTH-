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

    // Drop existing tables to cleanly switch to UUIDs
    await pool.query('DROP TABLE IF EXISTS listings CASCADE');
    await pool.query('DROP TABLE IF EXISTS otps CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    
    // 1. Create Users Table
    await pool.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
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

    // 3. Seed Users
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = 'Password@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    let insertedCount = 0;
    for (const user of dummyUsers) {
      try {
        await pool.query(
          'INSERT INTO users (name, email, password, email_verified) VALUES ($1, $2, $3, $4)',
          [user.name, user.email, hashedPassword, true]
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
          title: 'Cosmic Byte CB-GK-16 Mechanical Keyboard',
          description: 'Outemu Blue Clicky Switches, Rainbow Backlight, 87 Keys layout. Excellent tactile feedback.',
          price: 1200,
          category: 'Gaming',
          image_url: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=500&auto=format&fit=crop&q=60',
          condition: 'Excellent',
          rent_price: 25,
          deposit: 300,
          location: 'Boys Hostel',
          delivery_available: true,
          delivery_charge: 15,
          pickup_time: '10 min',
          image_urls: ['https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=500&auto=format&fit=crop&q=60']
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
