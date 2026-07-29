const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('./config/db');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Reading frontend mock data...');
    const mockDataPath = path.join(__dirname, '../frontend/src/data/mockData.js');
    let content = fs.readFileSync(mockDataPath, 'utf8');

    // Convert ES Modules exports to CommonJS exports
    content = content.replace(/export const/g, 'const');
    content += '\nmodule.exports = { mockSellers, mockProducts };';

    const tempFilePath = path.join(__dirname, 'tempMockData.js');
    fs.writeFileSync(tempFilePath, content, 'utf8');

    const { mockSellers, mockProducts } = require('./tempMockData');

    console.log(`Loaded ${mockSellers.length} sellers and ${mockProducts.length} products.`);

    await client.query('BEGIN');

    // Drop tables to re-seed cleanly in reverse dependency order
    console.log('Cleaning existing tables...');
    await client.query('DROP TABLE IF EXISTS refunds CASCADE');
    await client.query('DROP TABLE IF EXISTS payments CASCADE');
    await client.query('DROP TABLE IF EXISTS rentals CASCADE');
    await client.query('DROP TABLE IF EXISTS listings CASCADE');
    await client.query('DROP TABLE IF EXISTS cart CASCADE');
    await client.query('DROP TABLE IF EXISTS wishlist CASCADE');
    await client.query('DROP TABLE IF EXISTS pending_orders CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');

    // 1. Recreate Users Table
    console.log('Recreating tables...');
    await client.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        username VARCHAR(255) UNIQUE,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        phone_number VARCHAR(50),
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

    // 2. Recreate Listings Table
    await client.query(`
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

    // 3. Recreate Rentals Table
    await client.query(`
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

    // 4. Recreate Payments Table
    await client.query(`
      CREATE TABLE payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rental_id UUID REFERENCES rentals(id) ON DELETE CASCADE,
        payment_type VARCHAR(50) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        payment_gateway VARCHAR(50) DEFAULT 'razorpay',
        gateway_order_id VARCHAR(255),
        gateway_payment_id VARCHAR(255),
        gateway_signature VARCHAR(512),
        status VARCHAR(30) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Recreate Refunds Table
    await client.query(`
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

    // 6. Create Cart Table
    await client.query(`
      CREATE TABLE cart (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        item_id UUID REFERENCES listings(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days INTEGER NOT NULL,
        price_per_day DECIMAL(10, 2) NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, item_id)
      );
    `);
    console.log('Cart table ready.');

    // 7. Create Wishlist Table
    await client.query(`
      CREATE TABLE wishlist (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        item_id UUID REFERENCES listings(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, item_id)
      );
    `);
    console.log('Wishlist table ready.');

    // 8. Create Pending Orders Table (for cart checkout caching)
    await client.query(`
      CREATE TABLE pending_orders (
        id VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        booking_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Pending orders table ready.');

    const salt = await bcrypt.genSalt(10);
    const defaultPassword = 'Password@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    // Insert Sellers
    console.log('Inserting sellers into users table...');
    const sellerIdMap = {}; // Maps 's-1' to database UUID
    for (const seller of mockSellers) {
      const username = seller.name.toLowerCase().replace(/\s+/g, '') + seller.id.replace('s-', '');
      const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seller.name)}`;
      const bio = `Hi, I'm ${seller.name} from the ${seller.department} department. Happy to share my study and lab resources.`;
      const hostel = seller.location || (seller.id.charCodeAt(2) % 2 === 0 ? 'Boys Hostel A' : 'Girls Hostel');
      
      const res = await client.query(
        `INSERT INTO users (name, username, email, password, phone_number, avatar_url, bio, department, hostel, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [seller.name, username, seller.email.toLowerCase(), hashedPassword, '+9198765432' + seller.id.replace('s-', ''), avatarUrl, bio, seller.department, hostel, true]
      );
      sellerIdMap[seller.id] = res.rows[0].id;
    }

    // Insert Products
    console.log('Inserting listings into listings table...');
    for (const product of mockProducts) {
      const ownerUuid = sellerIdMap[product.sellerId] || sellerIdMap['s-1'];
      await client.query(
        `INSERT INTO listings (
          title, description, price, category, image_url, owner_id,
          condition, rent_price, deposit, location, delivery_available, delivery_charge, pickup_time, image_urls
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          product.title,
          product.description,
          product.price,
          product.category,
          product.image_url,
          ownerUuid,
          product.condition || 'Good',
          product.rentPrice || 10,
          product.deposit || 100,
          product.location || 'Library',
          product.deliveryAvailable || false,
          product.deliveryAvailable ? 15.00 : 0.00,
          product.pickupTime || '5 min',
          [product.image_url]
        ]
      );
    }

    await client.query('COMMIT');
    console.log('Database successfully seeded with mock data and updated schema!');
    
    // Cleanup temp file
    fs.unlinkSync(tempFilePath);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
  } finally {
    client.release();
  }
}

seed().then(() => process.exit(0));
