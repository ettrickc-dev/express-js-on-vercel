// lib/mailer.js
// Sends email using Brevo (formerly Sendinblue)

export async function sendEmailWithAttachment({ to, subject, html, filename, buffer, mime }) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.MAIL_FROM || 'no-reply@fastlegaltemplates.com';

  if (!apiKey) throw new Error('Missing BREVO_API_KEY');

  const body = {
    sender: { email: from, name: 'Fast Legal Templates' },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    attachment: [
      {
        name: filename,
        content: Buffer.from(buffer).toString('base64')
      }
    ]
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Brevo send error:', text);
    throw new Error('Failed to send email');
  }
}

