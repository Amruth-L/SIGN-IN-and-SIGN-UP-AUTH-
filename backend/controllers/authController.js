const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail.endsWith('@dbit.co.in')) {
      return res.status(400).json({ error: 'Only DBIT emails (@dbit.co.in) are allowed' });
    }

    // Check if user already exists
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Expiry: 10 minutes from now
    const otpExpiry = new Date(Date.now() + 10 * 60000);

    const newUser = await pool.query(
      'INSERT INTO users (name, email, password, otp, otp_expiry) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, created_at',
      [name, normalizedEmail, hashedPassword, otp, otpExpiry]
    );

    // Send Email
    const sendEmail = require('../utils/sendEmail');
    try {
      await sendEmail(normalizedEmail, 'Your CampusMesh Verification Code', otp, name);
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
      // We still return success but maybe warn about email failure
    }

    res.status(201).json({
      message: 'OTP sent to your email.'
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ error: 'Expired OTP' });
    }

    // OTP is valid
    await pool.query(
      'UPDATE users SET email_verified = TRUE, otp = NULL, otp_expiry = NULL WHERE email = $1',
      [email]
    );

    res.json({ message: 'Email verified successfully.' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
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
      'UPDATE users SET otp = $1, otp_expiry = $2 WHERE email = $3',
      [otp, otpExpiry, email]
    );

    const sendEmail = require('../utils/sendEmail');
    await sendEmail(email, 'Your CampusMesh Verification Code', otp, user.name);

    res.json({ message: 'OTP sent to your email.' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      // Don't leak whether user exists for security, just return success
      return res.json({ message: 'If that email exists, a reset code has been sent.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60000);

    await pool.query(
      'UPDATE users SET otp = $1, otp_expiry = $2 WHERE email = $3',
      [otp, otpExpiry, email]
    );

    const sendEmail = require('../utils/sendEmail');
    await sendEmail(email, 'Your CampusMesh Password Reset Code', otp, user.name);

    res.json({ message: 'If that email exists, a reset code has been sent.' });
  } catch (error) {
    console.error(error.message);
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

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ error: 'Expired OTP' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password, clear OTP, and implicitly verify email if not already verified
    await pool.query(
      'UPDATE users SET password = $1, otp = NULL, otp_expiry = NULL, email_verified = TRUE WHERE email = $2',
      [hashedPassword, email]
    );

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
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
      message: 'Login successful',
      token
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.user.id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userResult.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.logout = (req, res) => {
  res.json({
    message: 'Logout successful. Delete the JWT from the client.'
  });
};
