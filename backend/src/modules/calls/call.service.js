const pool = require('../../config/database');
const twilio = require('twilio');
const { recommendations } = require('../intelligence/intelligence.service');
const { answer } = require('../support/support.service');
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
// One voice style for greetings, reminders, replies and opt-out confirmations.
const saySoft = (node, text) =>
  node.say({ voice: 'Polly.Aditi', language: 'en-IN' }, '').prosody({ rate: '90%', volume: 'soft' }, text);
const E164 = /^\+[1-9]\d{7,14}$/;
const activeRentalStatuses = [
  'RENTAL_ACTIVE',
  'RETURN_PENDING',
  'RETURN_MATCHING',
  'RETURN_COURIER_ASSIGNED',
  'RETURN_IN_TRANSIT',
];
function config() {
  return {
    live: process.env.CALLS_MODE === 'live',
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM_NUMBER,
    verify: process.env.TWILIO_VERIFY_SERVICE_SID,
    base: process.env.PUBLIC_API_URL?.replace(/\/$/, ''),
    enabled: process.env.CALLS_SCHEDULER_ENABLED === 'true',
  };
}
function ready(c = config()) {
  return Boolean(
    c.live &&
    /^AC[\da-f]{32}$/i.test(c.sid || '') &&
    c.token &&
    E164.test(c.from || '') &&
    /^https:\/\//.test(c.base || ''),
  );
}
function localTime(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}
function inCallWindow(date = new Date()) {
  const { hour } = localTime(date);
  return hour >= 9 && hour < 19;
}
function reminderStage(endDate, today = localTime().day) {
  const delta = Math.round(
    (Date.parse(endDate + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000,
  );
  return delta === 1 ? 'tomorrow' : delta === 0 ? 'today' : delta === -1 ? 'overdue' : null;
}
function scriptFor(kind, data) {
  if (kind === 'DUE_REMINDER')
    return `This is CampusMesh's automated assistant. Your rental of ${data.title} is ${data.stage === 'overdue' ? 'past its return date' : `due ${data.stage}`}. The agreed return date is ${data.end_date}. Please open My rentals to arrange the return or request an extension. An extension needs approval. We will never ask for an account OTP or payment PIN on this call.`;
  return `This is CampusMesh's automated assistant. You opted in to rental recommendations. ${data.title} is listed at ${Number(data.rent_price)} rupees per day. ${data.reason}. You can review dates and availability in CampusMesh. No booking or payment will be made on this call.`;
}
function createCallService({
  db = pool,
  settings = config,
  providerFactory = (c) => twilio(c.sid, c.token),
  clock = () => new Date(),
  recommend = recommendations,
  supportAnswer = answer,
} = {}) {
  const status = () => {
    const c = settings();
    return {
      mode: ready(c) ? 'live' : 'preview',
      provider: 'twilio',
      configured: ready(c),
      schedulerEnabled: ready(c) && c.enabled,
      phoneVerificationConfigured: Boolean(ready(c) && c.verify),
      language: 'English',
      window: '09:00–19:00 Asia/Kolkata',
      limits: 'At most one call per day; recommendations at most once per seven days.',
    };
  };
  const preferences = async (userId) => {
    await db.query('INSERT INTO call_preferences(user_id) VALUES($1) ON CONFLICT DO NOTHING', [userId]);
    return (await db.query('SELECT * FROM call_preferences WHERE user_id=$1', [userId])).rows[0];
  };
  const updatePreferences = async (userId, body) => {
    if (
      typeof body.reminders_enabled !== 'boolean' ||
      typeof body.recommendations_enabled !== 'boolean' ||
      typeof body.phone_e164 !== 'string' ||
      (body.phone_e164 && !E164.test(body.phone_e164))
    )
      fail(
        400,
        'Use a phone number with country code, such as +91 followed by 10 digits, and choose both preferences.',
      );
    const c = await db.connect();
    try {
      await c.query('BEGIN');
      await c.query('INSERT INTO call_preferences(user_id) VALUES($1) ON CONFLICT DO NOTHING', [userId]);
      await c.query('SELECT user_id FROM call_preferences WHERE user_id=$1 FOR UPDATE', [userId]);
      const { rows } = await c.query(
        `UPDATE call_preferences SET phone_verified_at=CASE WHEN phone_e164 IS NOT DISTINCT FROM NULLIF($2,'') THEN phone_verified_at ELSE NULL END,phone_e164=NULLIF($2,''),reminders_enabled=$3,recommendations_enabled=$4,updated_at=NOW() WHERE user_id=$1 RETURNING *`,
        [userId, body.phone_e164, body.reminders_enabled, body.recommendations_enabled],
      );
      await c.query(
        "INSERT INTO call_consent_events(user_id,reminders_enabled,recommendations_enabled,consent_version) VALUES($1,$2,$3,'2026-10-14')",
        [userId, body.reminders_enabled, body.recommendations_enabled],
      );
      await c.query('COMMIT');
      await db.query(
        "UPDATE automated_calls SET status='CANCELLED',outcome='Preferences changed' WHERE user_id=$1 AND status='QUEUED'",
        [userId],
      );
      return rows[0];
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  };
  const verifyPhone = async (userId, code) => {
    const c = settings(),
      prefs = await preferences(userId);
    if (!ready(c) || !c.verify)
      fail(
        503,
        'Phone verification becomes available after the calling provider is connected. Preview works without it.',
      );
    if (!E164.test(prefs.phone_e164 || '')) fail(400, 'Save your phone number first.');
    if (code !== undefined && !/^\d{4,8}$/.test(String(code)))
      fail(400, 'Enter the verification code sent to your phone.');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT user_id FROM call_preferences WHERE user_id=$1 FOR UPDATE', [userId]);
      const count = await client.query(
        "SELECT COUNT(*)::int n FROM phone_verification_attempts WHERE user_id=$1 AND created_at>NOW()-INTERVAL '1 hour'",
        [userId],
      );
      if (count.rows[0].n >= 8) fail(429, 'Too many verification attempts. Try again in an hour.');
      await client.query('INSERT INTO phone_verification_attempts(user_id) VALUES($1)', [userId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    const service = providerFactory(c).verify.v2.services(c.verify);
    if (code !== undefined) {
      const result = await service.verificationChecks.create({ to: prefs.phone_e164, code: String(code) });
      if (result.status !== 'approved') fail(400, 'The verification code is incorrect or expired.');
      const verified = await db.query(
        'UPDATE call_preferences SET phone_verified_at=NOW() WHERE user_id=$1 AND phone_e164=$2',
        [userId, prefs.phone_e164],
      );
      if (!verified.rowCount) fail(409, 'Your phone number changed. Verify the new number.');
      return { verified: true };
    }
    await service.verifications.create({ to: prefs.phone_e164, channel: 'sms' });
    return { sent: true };
  };
  const candidates = async (userId, prefs, preview = false) => {
    const result = [];
    const today = localTime(clock()).day;
    if (preview || prefs.reminders_enabled) {
      const { rows } = await db.query(
        `SELECT r.id,l.title,r.end_date::text end_date FROM rentals r JOIN listings l ON l.id=r.listing_id WHERE r.borrower_id=$1 AND r.status=ANY($2) AND r.payment_status='FULLY_PAID' AND l.demo_slug IS NULL AND r.end_date BETWEEN $3::date-1 AND $3::date+1`,
        [userId, activeRentalStatuses, today],
      );
      for (const row of rows) {
        const stage = reminderStage(row.end_date, today);
        if (stage)
          result.push({
            kind: 'DUE_REMINDER',
            rental_id: row.id,
            payload: { ...row, stage },
            key: `due:${userId}:${row.id}:${row.end_date}:${stage}`,
          });
      }
    }
    if (preview || prefs.recommendations_enabled) {
      const listing = (await recommend(userId, { db, includeDemo: false })).find((l) => l.evidence >= 5);
      if (listing) {
        const date = new Date(today + 'T00:00:00Z');
        date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
        result.push({
          kind: 'RECOMMENDATION',
          listing_id: listing.id,
          payload: { title: listing.title, rent_price: Number(listing.rent_price), reason: listing.reason },
          key: `recommendation:${userId}:${date.toISOString().slice(0, 10)}`,
        });
      }
    }
    return result;
  };
  const preview = async (userId) => {
    const prefs = await preferences(userId);
    const list = await candidates(userId, prefs, true);
    return {
      status: status(),
      previews: list.map((j) => ({
        ...j,
        script: scriptFor(j.kind, j.payload),
        eligible: j.kind === 'DUE_REMINDER' ? prefs.reminders_enabled : prefs.recommendations_enabled,
      })),
      sample: {
        example: true,
        kind: 'DUE_REMINDER',
        script: scriptFor('DUE_REMINDER', {
          title: 'a calculator',
          stage: 'tomorrow',
          end_date: new Date(Date.parse(localTime(clock()).day + 'T00:00:00Z') + 86400000)
            .toISOString()
            .slice(0, 10),
        }),
      },
      note: 'Preview only. No phone is called, and no real reminder is created for a demo rental.',
    };
  };
  const enqueue = async () => {
    if (!ready(settings()) || !settings().enabled) return { queued: 0, mode: 'preview' };
    const users = (
      await db.query(
        'SELECT * FROM call_preferences WHERE phone_verified_at IS NOT NULL AND (reminders_enabled OR recommendations_enabled)',
      )
    ).rows;
    let queued = 0;
    for (const prefs of users) {
      for (const j of await candidates(prefs.user_id, prefs)) {
        const r = await db.query(
          `INSERT INTO automated_calls(user_id,rental_id,listing_id,kind,dedupe_key,payload,script) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(dedupe_key) DO NOTHING`,
          [
            prefs.user_id,
            j.rental_id || null,
            j.listing_id || null,
            j.kind,
            j.key,
            j.payload,
            scriptFor(j.kind, j.payload),
          ],
        );
        queued += r.rowCount;
      }
    }
    return { queued };
  };
  const eligible = async (job, prefs, client) => {
    if (
      !prefs?.phone_verified_at ||
      !E164.test(prefs.phone_e164 || '') ||
      !(job.kind === 'DUE_REMINDER' ? prefs.reminders_enabled : prefs.recommendations_enabled)
    )
      return false;
    if (job.kind === 'DUE_REMINDER') {
      const r = await client.query(
        `SELECT r.end_date::text end_date,r.status FROM rentals r JOIN listings l ON l.id=r.listing_id WHERE r.id=$1 AND r.borrower_id=$2 AND r.payment_status='FULLY_PAID' AND l.demo_slug IS NULL`,
        [job.rental_id, job.user_id],
      );
      return Boolean(
        r.rows[0] &&
        activeRentalStatuses.includes(r.rows[0].status) &&
        r.rows[0].end_date === job.payload.end_date &&
        reminderStage(r.rows[0].end_date, localTime(clock()).day) === job.payload.stage,
      );
    }
    if (clock().getTime() - new Date(job.created_at).getTime() > 7 * 86400000) return false;
    const l = await client.query(
      `SELECT 1 FROM listings l WHERE l.id=$1 AND l.is_active AND l.demo_slug IS NULL AND l.owner_id<>$2 AND l.rent_price=$3 AND NOT EXISTS(SELECT 1 FROM rentals r WHERE r.listing_id=l.id AND r.status NOT IN ('COMPLETED','CANCELLED','REJECTED','DEPOSIT_REFUNDED') AND r.start_date<=CURRENT_DATE AND r.end_date>=CURRENT_DATE)`,
      [job.listing_id, job.user_id, job.payload.rent_price],
    );
    return Boolean(l.rowCount);
  };
  const dispatchOne = async () => {
    const c = settings();
    if (!ready(c) || !c.enabled || !inCallWindow(clock())) return { skipped: true };
    const client = await db.connect();
    let job, prefs;
    try {
      await client.query('BEGIN');
      // Unknown transport outcomes are never retried automatically: that could ring twice.
      await client.query(
        "UPDATE automated_calls SET status='UNKNOWN',last_error='Provider acceptance needs reconciliation' WHERE status='DISPATCHING' AND started_at<NOW()-INTERVAL '5 minutes'",
      );
      job = (
        await client.query(
          "SELECT * FROM automated_calls WHERE status='QUEUED' AND scheduled_at<=NOW() ORDER BY CASE WHEN kind='DUE_REMINDER' THEN 0 ELSE 1 END,scheduled_at LIMIT 1 FOR UPDATE SKIP LOCKED",
        )
      ).rows[0];
      if (!job) {
        await client.query('COMMIT');
        return { empty: true };
      }
      prefs = (
        await client.query('SELECT * FROM call_preferences WHERE user_id=$1 FOR UPDATE', [job.user_id])
      ).rows[0];
      if (!(await eligible(job, prefs, client))) {
        await client.query(
          "UPDATE automated_calls SET status='CANCELLED',outcome='No longer eligible' WHERE id=$1",
          [job.id],
        );
        await client.query('COMMIT');
        return { cancelled: true };
      }
      const cap = await client.query(
        `SELECT 1 FROM automated_calls WHERE user_id=$1 AND id<>$2 AND started_at IS NOT NULL AND (started_at>NOW()-INTERVAL '1 day' OR ($3='RECOMMENDATION' AND kind='RECOMMENDATION' AND started_at>NOW()-INTERVAL '7 days')) LIMIT 1`,
        [job.user_id, job.id, job.kind],
      );
      if (cap.rowCount) {
        await client.query("UPDATE automated_calls SET scheduled_at=NOW()+INTERVAL '1 hour' WHERE id=$1", [
          job.id,
        ]);
        await client.query('COMMIT');
        return { limited: true };
      }
      await client.query("UPDATE automated_calls SET status='DISPATCHING',started_at=NOW() WHERE id=$1", [
        job.id,
      ]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    // Recheck opt-out immediately before the paid provider operation.
    const latest = await preferences(job.user_id);
    if (!(await eligible(job, latest, db))) {
      await db.query(
        "UPDATE automated_calls SET status='CANCELLED',outcome='Preferences or rental changed' WHERE id=$1",
        [job.id],
      );
      return { cancelled: true };
    }
    try {
      const call = await providerFactory(c).calls.create({
        to: latest.phone_e164,
        from: c.from,
        url: `${c.base}/api/calls/webhooks/${job.id}/voice`,
        method: 'POST',
        statusCallback: `${c.base}/api/calls/webhooks/${job.id}/status`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        timeout: 20,
        timeLimit: 120,
      });
      await db.query(
        "UPDATE automated_calls SET provider_sid=COALESCE(provider_sid,$2),status=CASE WHEN status='DISPATCHING' THEN 'SENT' ELSE status END WHERE id=$1",
        [job.id, call.sid],
      );
      return { sent: true };
    } catch (e) {
      const definite = Number(e.status) >= 400 && Number(e.status) < 500;
      await db.query('UPDATE automated_calls SET status=$2,last_error=$3 WHERE id=$1', [
        job.id,
        definite ? 'FAILED' : 'UNKNOWN',
        definite
          ? 'Provider rejected the call'
          : 'Provider acceptance uncertain; check provider logs before retrying',
      ]);
      return { failed: true };
    }
  };
  const voice = async (id, body, kind) => {
    const job = (await db.query('SELECT * FROM automated_calls WHERE id=$1', [id])).rows[0];
    const response = new twilio.twiml.VoiceResponse();
    if (
      !job ||
      !['DISPATCHING', 'SENT', 'RINGING', 'ANSWERED'].includes(job.status) ||
      (job.provider_sid && job.provider_sid !== body.CallSid)
    ) {
      response.hangup();
      return response.toString();
    }
    const prefs = await preferences(job.user_id);
    if (!(await eligible(job, prefs, db))) {
      saySoft(response, 'This reminder is no longer needed. Goodbye.');
      response.hangup();
      return response.toString();
    }
    if (body.Digits === '9' || /\b(stop|unsubscribe)\b/i.test(body.SpeechResult || '')) {
      await updatePreferences(job.user_id, {
        phone_e164: prefs.phone_e164,
        reminders_enabled: false,
        recommendations_enabled: false,
      });
      await db.query("UPDATE automated_calls SET outcome='Opted out' WHERE id=$1", [id]);
      saySoft(response, 'Automated calls have been switched off. Goodbye.');
      response.hangup();
      return response.toString();
    }
    if (kind === 'voice') {
      saySoft(
        response.gather({
          numDigits: 1,
          timeout: 7,
          action: `${settings().base}/api/calls/webhooks/${id}/answer`,
          method: 'POST',
        }),
        'Hello. This is the automated CampusMesh assistant. Press 1 to hear your update. Press 9 to stop automated calls.',
      );
      response.hangup();
      return response.toString();
    }
    const turns = (
      await db.query(
        "UPDATE automated_calls SET payload=jsonb_set(payload,'{voiceTurns}',to_jsonb(COALESCE((payload->>'voiceTurns')::int,0)+1)) WHERE id=$1 RETURNING (payload->>'voiceTurns')::int turns",
        [id],
      )
    ).rows[0].turns;
    if (turns > 3) {
      saySoft(response, 'Please open Support in CampusMesh for more help. Goodbye.');
      response.hangup();
      return response.toString();
    }
    let speech = job.script;
    if (body.SpeechResult) {
      const rentals =
        job.kind === 'DUE_REMINDER'
          ? (
              await db.query(
                'SELECT l.title,r.end_date::text due_date,r.status,r.payment_status FROM rentals r JOIN listings l ON l.id=r.listing_id WHERE r.id=$1 AND r.borrower_id=$2',
                [job.rental_id, job.user_id],
              )
            ).rows
          : [];
      const result = await supportAnswer(job.user_id, String(body.SpeechResult).slice(0, 1500), {
        save: false,
        contextOverride: { rentals, wishes: [] },
      });
      speech = result.answer;
    } else if (body.Digits !== '1') {
      saySoft(response, 'Please open CampusMesh to review your update. Goodbye.');
      response.hangup();
      return response.toString();
    }
    saySoft(response, speech.slice(0, 1600));
    saySoft(
      response.gather({
        input: 'speech dtmf',
        numDigits: 1,
        language: 'en-IN',
        speechTimeout: 'auto',
        timeout: 5,
        action: `${settings().base}/api/calls/webhooks/${id}/answer`,
        method: 'POST',
      }),
      'You can ask a short question about CampusMesh, or press 9 to stop automated calls.',
    );
    response.hangup();
    return response.toString();
  };
  return {
    status,
    preferences,
    updatePreferences,
    verifyPhone,
    preview,
    enqueue,
    dispatchOne,
    voice,
    eligible,
  };
}
module.exports = {
  createCallService,
  config,
  ready,
  localTime,
  inCallWindow,
  reminderStage,
  scriptFor,
  E164,
};
