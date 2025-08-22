// pages/api/send-sms.js
const twilio = require('twilio');

function toE164(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? digits : `+1${digits}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token || token !== process.env.RETELL_FUNCTION_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    const { to, body, metadata = {} } = req.body || {};
    const toNumber = toE164(to);
    if (!toNumber || !body) {
      return res.status(400).json({ ok: false, error: 'Missing to or body' });
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const args = { to: toNumber, body };
    if (process.env.TWILIO_MESSAGING_SID) args.messagingServiceSid = process.env.TWILIO_MESSAGING_SID;
    else args.from = process.env.TWILIO_FROM_NUMBER;

    const message = await client.messages.create(args);

    return res.status(200).json({
      ok: true,
      sid: message.sid,
      to: toNumber,
      message_status: message.status || 'queued',
      metadata
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'Unknown error' });
  }
}
