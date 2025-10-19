// api/claim-download.js
import Stripe from 'stripe';
import { Store } from '../lib/store';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');
  try {
    let body = req.body;
    if (!body || typeof body !== 'object') {
      const text = await new Promise((resolve) => {
        let data = '';
        req.on('data', (c) => (data += c));
        req.on('end', () => resolve(data));
      });
      body = text ? JSON.parse(text) : {};
    }
    const { sessionId } = body;

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') return res.status(403).end('Not paid');

    const f = Store.getFile(sessionId);
    if (!f) return res.status(404).end('File not ready');

    const url = `${process.env.PUBLIC_BASE_URL.replace(/\/+$/,'')}/api/download-once?token=${encodeURIComponent(sessionId)}`;

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ downloadUrl: url }));
  } catch (e) {
    console.error('claim-download error:', e);
    res.status(500).end('Failed to provide download');
  }
}
