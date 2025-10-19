// lib/mailer.js
export async function sendEmailWithAttachment({ to, subject, html, filename, buffer, mime }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error('Missing SENDGRID_API_KEY');

  const body = {
    personalizations: [{ to: [{ email: to }] }],
    from: {
      email: process.env.MAIL_FROM || 'no-reply@fastlegaltemplates.com',
      name: 'Fast Legal Templates'
    },
    subject,
    content: [{ type: 'text/html', value: html }],
    attachments: [{
      content: Buffer.from(buffer).toString('base64'),
      filename,
      type: mime,
      disposition: 'attachment'
    }]
  };

  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`SendGrid error: ${resp.status} ${txt}`);
  }
}
