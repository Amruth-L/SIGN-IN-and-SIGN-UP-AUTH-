const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (error) => {
  console.error('[database] Unexpected idle client error', error);
});

module.exports = pool;
