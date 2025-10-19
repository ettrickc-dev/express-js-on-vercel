// api/stripe-webhook.js
import Stripe from 'stripe';
import { Store } from '../lib/store';
import { renderPaidZip } from '../lib/render';
import { sendEmailWithAttachment } from '../lib/mailer';

export const config = { api: { bodyParser: false } }; // needed for raw body
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function getRawBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('stripe-webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const draftId = session.metadata?.draftId;
      const email = session.customer_details?.email || session.customer_email;
      const draft = Store.getDraft(draftId);

      if (draft) {
        const { buffer, filename, mime } = await renderPaidZip(draft);

        await sendEmailWithAttachment({
          to: email,
          subject: 'Your Nursing Appeal Pack',
          html: `<p>Hi ${draft.name || 'there'},</p>
                 <p>Thanks for your purchase. Your files are attached.</p>`,
          filename,
          buffer,
          mime
        });

        // cache for success page auto-download (30 minutes)
        Store.saveFile(session.id, {
          buffer,
          filename,
          mime,
          expiresAt: Date.now() + 1000 * 60 * 30
        });
      }
    }

    res.json({ received: true });
  } catch (e) {
    console.error('stripe-webhook handler error:', e);
    res.status(500).end('Webhook handling failed');
  }
}
