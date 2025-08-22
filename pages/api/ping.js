export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, time: new Date().toISOString() });
  }
  res.setHeader('Allow', ['GET']);
  return res.status(405).end('Method Not Allowed');
}
