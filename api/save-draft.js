// api/save-draft.js
import { Store } from '../lib/store';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed');
    return;
  }
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

    const id = crypto.randomUUID();
    Store.saveDraft({ id, ...body, createdAt: Date.now() });

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ draftId: id }));
  } catch (e) {
    console.error('save-draft error:', e);
    res.status(500).end('Failed to save draft');
  }
}
