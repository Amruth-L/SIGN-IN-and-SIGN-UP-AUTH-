const pool = require('../../config/database');

function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  const digits = value.trim().replace(/[\s()-]/g, '');
  const phone = /^\d{10}$/.test(digits) ? '+91' + digits : digits;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

async function recordFirstSignIn(userId, db = pool) {
  // An atomic update keeps concurrent successful sign-ins from both being first.
  const first = await db.query(
    'UPDATE users SET first_signed_in_at=NOW() WHERE id=$1 AND first_signed_in_at IS NULL RETURNING id',
    [userId],
  );
  if (!first.rowCount) return false;
  const { rows } = await db.query(
    'SELECT welcome_enabled,booking_enabled,reminders_enabled,phone_verified_at FROM call_preferences WHERE user_id=$1',
    [userId],
  );
  return Boolean((rows[0]?.welcome_enabled || rows[0]?.booking_enabled || rows[0]?.reminders_enabled) && !rows[0].phone_verified_at);
}

module.exports = { normalizePhone, recordFirstSignIn };
