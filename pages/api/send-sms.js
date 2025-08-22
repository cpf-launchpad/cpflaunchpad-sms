// pages/api/send-sms.js

function toE164(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? digits : `+1${digits}`;
}

module.exports = async function handler(req, res) {
  try {
    // Only allow POST
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end('Method Not Allowed');
    }

    // Auth: shared secret
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token || token !== process.env.RETELL_FUNCTION_SECRET) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    // Validate env vars early (clear error instead of generic 500)
    const {
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_FROM_NUMBER,
      TWILIO_MESSAGING_SID,
    } = process.env;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN ||
        (!TWILIO_FROM_NUMBER && !TWILIO_MESSAGING_SID)) {
      return res.status(500).json({
        ok: false,
        error: 'Missing Twilio env vars (need ACCOUNT_SID, AUTH_TOKEN and FROM_NUMBER or MESSAGING_SID)'
      });
    }

    // Lazy-load Twilio AFTER the checks to avoid module errors on GET
    const twilio = require('twilio');

    // Body
    const { to, body, metadata = {} } = req.body || {};
    const toNumber = toE164(to);
    if (!toNumber || !body) {
      return res.status(400).json({ ok: false, error: 'Missing to or body' });
    }

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const args = { to: toNumber, body };
    if (TWILIO_MESSAGING_SID) args.messagingServiceSid = TWILIO_MESSAGING_SID;
    else args.from = TWILIO_FROM_NUMBER;

    const message = await client.messages.create(args);

    return res.status(200).json({
      ok: true,
      sid: message.sid,
      to: toNumber,
      message_status: message.status || 'queued',
      metadata
    });
  } catch (e) {
    // Echo the error message so we can see it in the response while debugging
    return res.status(500).json({ ok: false, error: e?.message || 'Unknown error' });
  }
};
