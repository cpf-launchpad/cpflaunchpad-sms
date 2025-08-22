// pages/api/send-sms.js

function toE164(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? digits : `+1${digits}`;
}

function extractPayload(body) {
  const b = body || {};
  // Handle common wrappers Retell/other tools might use
  return b.args || b.arguments || b.payload || b.data || b;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end('Method Not Allowed');
    }

    // Auth
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token || token !== process.env.RETELL_FUNCTION_SECRET) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    // Env
    const {
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_FROM_NUMBER,
      TWILIO_MESSAGING_SID,
      STATUS_CALLBACK_URL,
    } = process.env;
    if (
      !TWILIO_ACCOUNT_SID ||
      !TWILIO_AUTH_TOKEN ||
      (!TWILIO_FROM_NUMBER && !TWILIO_MESSAGING_SID)
    ) {
      return res.status(500).json({
        ok: false,
        error:
          'Missing Twilio env vars (need ACCOUNT_SID, AUTH_TOKEN and FROM_NUMBER or MESSAGING_SID)',
      });
    }

    // Body (tolerant to wrappers)
    const payload = extractPayload(req.body);
    const { to, body, metadata = {} } = payload || {};
    const toNumber = toE164(to);

    if (!toNumber || !body) {
      return res
        .status(400)
        .json({ ok: false, error: 'Missing to or body' });
    }

    // Lazy-load Twilio
    const twilioMod = await import('twilio');
    const twilio = twilioMod.default || twilioMod;

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const args = { to: toNumber, body };
    if (TWILIO_MESSAGING_SID) args.messagingServiceSid = TWILIO_MESSAGING_SID;
    else args.from = TWILIO_FROM_NUMBER;
    if (STATUS_CALLBACK_URL) args.statusCallback = STATUS_CALLBACK_URL;

    const message = await client.messages.create(args);

    return res.status(200).json({
      ok: true,
      sid: message.sid,
      to: toNumber,
      message_status: message.status || 'queued',
      metadata,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || 'Unknown error' });
  }
}
