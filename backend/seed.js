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
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
