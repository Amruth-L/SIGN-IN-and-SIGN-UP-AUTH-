const pool = require('../../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendCode, consumeCode } = require('./otp.service');
const emailOf = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validEmail = email => /^[^\s@]+@dbit\.co\.in$/.test(email);
const respondError = (res, result, extra = {}) => {
  if (result.retryAfter) res.set('Retry-After', String(result.retryAfter));
  return res.status(result.status).json({ ...result, ...extra });
};
const serverError = (res, error) => {
  console.error('[auth]', error.code || error.name);
  return res.status(503).json({ error: 'CampusMesh is temporarily unavailable. Please try again shortly.' });
};

exports.signup = async (req, res) => {
  const { name, username, password } = req.body;
  const email = emailOf(req.body.email);
  if (typeof name !== 'string' || !name.trim() || typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username.trim()))
    return res.status(400).json({ error: 'Enter your name and a username of 3–20 letters, numbers, or underscores.' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Use your DBIT email (@dbit.co.in).' });
  if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password) > 72)
    return res.status(400).json({ error: 'Use a password of at least 6 characters and at most 72 bytes.' });
  try {
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email)=$1', [email]);
    if (existing.rowCount) return res.status(409).json({ error: 'Email is already registered. Sign in or resend your verification code.' });
    await pool.query('INSERT INTO users(name,username,email,password) VALUES($1,$2,$3,$4)',
      [name.trim(), username.trim().toLowerCase(), email, await bcrypt.hash(password, 10)]);
    const result = await sendCode(email, 'verify', name.trim());
    if (result.error) return respondError(res, result, { accountCreated: true, email });
    return res.status(201).json({ message: 'Verification code sent. Check your email.', ...result });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Username or email is already registered.' });
    return serverError(res, error);
  }
};

exports.verifyEmail = async (req, res) => {
  const email = emailOf(req.body.email);
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter your DBIT email.' });
  try {
    const result = await consumeCode(email, 'verify', req.body.otp, client =>
      client.query('UPDATE users SET email_verified=TRUE,otp=NULL,otp_expiry=NULL WHERE email=$1', [email]));
    if (result.error) return respondError(res, result);
    return res.json({ message: 'Email verified. You can now sign in.' });
  } catch (error) { return serverError(res, error); }
};

exports.resendOtp = async (req, res) => {
  const email = emailOf(req.body.email);
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter your DBIT email.' });
  try {
    const { rows } = await pool.query('SELECT name,email_verified FROM users WHERE email=$1', [email]);
    if (!rows[0]) return res.status(404).json({ error: 'Create an account before requesting a verification code.' });
    if (rows[0].email_verified) return res.status(409).json({ error: 'Email already verified. Please sign in.' });
    const result = await sendCode(email, 'verify', rows[0].name);
    if (result.error) return respondError(res, result);
    return res.json({ message: 'A new verification code has been sent.', ...result });
  } catch (error) { return serverError(res, error); }
};

exports.forgotPassword = async (req, res) => {
  const email = emailOf(req.body.email);
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter your DBIT email.' });
  try {
    const { rows } = await pool.query('SELECT name FROM users WHERE email=$1', [email]);
    if (rows[0]) {
      const result = await sendCode(email, 'reset', rows[0].name);
      if (result.error) return respondError(res, result);
    }
    return res.json({ message: 'If an account exists, a reset code has been sent.', retryAfter: 60, expiresIn: 600 });
  } catch (error) { return serverError(res, error); }
};

exports.resetPassword = async (req, res) => {
  const email = emailOf(req.body.email);
  const { newPassword } = req.body;
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter your DBIT email.' });
  if (typeof newPassword !== 'string' || newPassword.length < 6 || Buffer.byteLength(newPassword) > 72)
    return res.status(400).json({ error: 'Use a password of at least 6 characters and at most 72 bytes.' });
  try {
    const result = await consumeCode(email, 'reset', req.body.otp, async client => {
      const password = await bcrypt.hash(newPassword, 10);
      await client.query('UPDATE users SET password=$1,otp=NULL,otp_expiry=NULL,email_verified=TRUE WHERE email=$2', [password, email]);
    });
    if (result.error) return respondError(res, result);
    return res.json({ message: 'Password reset. You can now sign in.' });
  } catch (error) { return serverError(res, error); }
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
    return serverError(res, error);
  }
};

exports.setMode = async (req, res) => {
  const mode = String(req.body.mode || '').toUpperCase();
  if (!['RENT', 'DELIVERY'].includes(mode)) return res.status(400).json({ error: 'Mode must be RENT or DELIVERY.' });
  // A workspace switch changes navigation preference, not delivery availability.
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
