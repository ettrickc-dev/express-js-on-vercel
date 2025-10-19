// api/download-once.js
import { Store } from '../lib/store';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const token = url.searchParams.get('token');
    if (!token) return res.status(400).end('Missing token');

    const f = Store.getFile(token);
    if (!f) return res.status(404).end('Expired or not found');

    // Optional: make it one-time by expiring after serve.
    // Store.saveFile(token, { ...f, expiresAt: Date.now() - 1 });

    res.setHeader('Content-Type', f.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${f.filename}"`);
    res.end(f.buffer);
  } catch (e) {
    console.error('download-once error:', e);
    res.status(500).end('Failed to download');
  }
}
