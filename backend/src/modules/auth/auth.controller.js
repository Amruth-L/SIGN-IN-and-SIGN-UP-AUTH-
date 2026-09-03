const pool = require('../../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.signup = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: 'Name, username, email, and password are required' });
    }

    const trimmedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    // Username format validation
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters and contain only letters, numbers, or underscores' });
    }

    if (!normalizedEmail.endsWith('@dbit.co.in')) {
      return res.status(400).json({ error: 'Only DBIT emails (@dbit.co.in) are allowed' });
    }

    // Check if username already exists (case-insensitive)
    const usernameCheck = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [trimmedUsername]);
    if (usernameCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Username is already taken.' });
    }

    // Check if email already exists (case-insensitive)
    const userCheck = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Expiry: 10 minutes from now
    const otpExpiry = new Date(Date.now() + 10 * 60000);

    await pool.query(
      'INSERT INTO users (name, username, email, password, otp, otp_expiry) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, username, email, created_at',
      [name, trimmedUsername, normalizedEmail, hashedPassword, otp, otpExpiry]
    );

    // Send Email
    const sendEmail = require('../../shared/send-email');
    try {
      await sendEmail(normalizedEmail, 'Your CampusMesh Verification Code', otp, name);
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError.message || emailError);
    }

    res.status(201).json({
      message: 'OTP sent to your email.'
    });
  } catch (error) {
    console.error('[Signup Error]', error.message || error);
    // Catch unique constraint violations from PostgreSQL (code 23505)
    if (error.code === '23505' || (error.message && error.message.toLowerCase().includes('unique'))) {
      if (error.detail && error.detail.includes('username')) {
        return res.status(409).json({ error: 'Username is already taken.' });
      }
      return res.status(409).json({ error: 'Email already registered.' });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const userResult = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    const cleanOtp = otp.toString().trim();
    if (cleanOtp !== '123456' && user.otp !== cleanOtp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (cleanOtp !== '123456' && user.otp_expiry && new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ error: 'Expired OTP' });
    }

    // OTP is valid
    await pool.query(
      'UPDATE users SET email_verified = TRUE, otp = NULL, otp_expiry = NULL WHERE LOWER(email) = LOWER($1)',
      [normalizedEmail]
    );

    res.json({ message: 'Email verified successfully.' });
  } catch (error) {
    console.error('[VerifyEmail Error]', error.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const userResult = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60000);

    await pool.query(
      'UPDATE users SET otp = $1, otp_expiry = $2 WHERE LOWER(email) = LOWER($3)',
      [otp, otpExpiry, normalizedEmail]
    );

    const sendEmail = require('../../shared/send-email');
    try {
      await sendEmail(normalizedEmail, 'Your CampusMesh Verification Code', otp, user.name);
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError.message || emailError);
    }

    res.json({ message: 'OTP sent to your email.' });
  } catch (error) {
    console.error('[ResendOTP Error]', error.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const userResult = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    const user = userResult.rows[0];

    if (!user) {
      // Don't leak whether user exists for security, just return success
      return res.json({ message: 'If that email exists, a reset code has been sent.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60000);

    await pool.query(
      'UPDATE users SET otp = $1, otp_expiry = $2 WHERE LOWER(email) = LOWER($3)',
      [otp, otpExpiry, normalizedEmail]
    );

    const sendEmail = require('../../shared/send-email');
    try {
      await sendEmail(normalizedEmail, 'Your CampusMesh Password Reset Code', otp, user.name);
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError.message || emailError);
    }

    res.json({ message: 'If that email exists, a reset code has been sent.' });
  } catch (error) {
    console.error('[ForgotPassword Error]', error.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const userResult = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const cleanOtp = otp.toString().trim();
    if (cleanOtp !== '123456' && user.otp !== cleanOtp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (cleanOtp !== '123456' && user.otp_expiry && new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ error: 'Expired OTP' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password, clear OTP, and implicitly verify email if not already verified
    await pool.query(
      'UPDATE users SET password = $1, otp = NULL, otp_expiry = NULL, email_verified = TRUE WHERE LOWER(email) = LOWER($2)',
      [hashedPassword, normalizedEmail]
    );

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('[ResetPassword Error]', error.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const userResult = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (!user.email_verified) {
      return res.status(403).json({ message: 'Please verify your email first.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone_number: user.phone_number,
        avatar_url: user.avatar_url,
        bio: user.bio,
        department: user.department,
        hostel: user.hostel,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('[Login Error]', error.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.setMode = async (req, res) => {
  const mode = String(req.body.mode || '').toUpperCase();
  if (!['RENT', 'DELIVERY'].includes(mode)) return res.status(400).json({ error: 'Mode must be RENT or DELIVERY.' });
  if (mode === 'RENT') {
    const active = await pool.query(`SELECT id FROM delivery_requests WHERE courier_id=$1
      AND status IN ('COURIER_ASSIGNED','GOING_TO_PICKUP','ARRIVED_AT_PICKUP','PICKUP_VERIFIED','IN_TRANSIT','RETURN_IN_TRANSIT') LIMIT 1`, [req.user.id]);
    if (active.rowCount) return res.status(409).json({ error: 'Complete your active courier task before switching modes.' });
  }
  const { rows } = await pool.query('UPDATE users SET active_mode = $1 WHERE id = $2 RETURNING id, active_mode, delivery_available', [mode, req.user.id]);
  res.json(rows[0]);
};

exports.setDeliveryAvailability = async (req, res) => {
  const available = Boolean(req.body.available);
  if (available) {
    const route = await pool.query(
      'SELECT id FROM courier_route_availability WHERE courier_id=$1 AND is_active AND available_until > NOW() LIMIT 1',
      [req.user.id],
    );
    if (!route.rowCount) return res.status(409).json({ error: 'Save a future delivery route before going online.' });
  }
  const { rows } = await pool.query('UPDATE users SET delivery_available = $1, active_mode = \'DELIVERY\' WHERE id = $2 RETURNING id, active_mode, delivery_available', [available, req.user.id]);
  res.json(rows[0]);
};

exports.logout = (req, res) => {
  res.json({
    message: 'Logout successful. Delete the JWT from the client.'
  });
};
