const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('WARNING: Supabase URL or Anon Key is missing from environment variables.');
}

// Initialize Supabase Client
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
