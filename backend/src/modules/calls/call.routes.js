const express = require('express');
const twilio = require('twilio');
const router = express.Router();
const pool = require('../../config/database');
const auth = require('../../middleware/authMiddleware');
const { createCallService, config, ready } = require('./call.service');
const service = createCallService();
router.use('/webhooks', express.urlencoded({ extended: false, limit: '20kb' }));
router.post('/webhooks/:id/:kind', async (req, res) => {
  const c = config();
  if (
    !ready(c) ||
    !twilio.validateRequest(c.token, req.get('X-Twilio-Signature') || '', c.base + req.originalUrl, req.body)
  )
    return res.status(403).json({ error: 'Invalid provider signature.' });
  if (!/^[a-f0-9-]{36}$/i.test(req.params.id) || !/^CA[\da-f]{32}$/i.test(req.body.CallSid || ''))
    return res.status(400).end();
  if (req.params.kind === 'status') {
    const mapped = {
      initiated: 'SENT',
      queued: 'SENT',
      ringing: 'RINGING',
      'in-progress': 'ANSWERED',
      completed: 'COMPLETED',
      busy: 'FAILED',
      'no-answer': 'FAILED',
      failed: 'FAILED',
      canceled: 'CANCELLED',
    }[req.body.CallStatus];
    const seq = Number(req.body.SequenceNumber);
    if (mapped && Number.isInteger(seq))
      await pool.query(
        `UPDATE automated_calls SET status=$2,provider_sid=COALESCE(provider_sid,$3),provider_sequence=$4,finished_at=CASE WHEN $2 IN ('COMPLETED','FAILED','CANCELLED') THEN NOW() ELSE finished_at END WHERE id=$1 AND (provider_sid IS NULL OR provider_sid=$3) AND provider_sequence<$4 AND status IN ('DISPATCHING','SENT','RINGING','ANSWERED','UNKNOWN')`,
        [req.params.id, mapped, req.body.CallSid, seq],
      );
    return res.status(204).end();
  }
  if (!['voice', 'answer'].includes(req.params.kind)) return res.status(404).end();
  res.type('text/xml').send(await service.voice(req.params.id, req.body, req.params.kind));
});
router.use(auth);
router.get('/', async (req, res) => {
  const preferences = await service.preferences(req.user.id);
  const { rows } = await pool.query(
    'SELECT id,kind,status,script,outcome,last_error,created_at,started_at FROM automated_calls WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30',
    [req.user.id],
  );
  res.json({ preferences, status: service.status(), calls: rows });
});
router.put('/preferences', async (req, res) =>
  res.json(await service.updatePreferences(req.user.id, req.body)),
);
router.post('/verify-phone', async (req, res) =>
  res.json(await service.verifyPhone(req.user.id, req.body.code)),
);
router.get('/preview', async (req, res) => res.json(await service.preview(req.user.id)));
module.exports = router;
