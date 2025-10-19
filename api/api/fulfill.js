// api/fulfill.js
const Stripe = require('stripe');
const JSZip = require('jszip');
const { TransactionalEmailsApi, SendSmtpEmail } = require('@getbrevo/brevo');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

/* ===== Minimal DOCX builder (Node) ===== */
function xmlEscape(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function docxParagraph(text){return String(text).split('\n').map(l=>`<w:p><w:r><w:t>${xmlEscape(l)}</w:t></w:r></w:p>`).join('');}
function docxPage(text){return docxParagraph(text)+`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;}
function buildDocxXml(pages){
  const body = pages.map(p=>docxPage(p)).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <w:document xmlns:wpc="http://schemas.microsoft.com/office/2010/word/wordprocessingCanvas"
    xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
    xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    xmlns:m="http://schemas.microsoft.com/office/2006/relationships"
    xmlns:v="urn:schemas-microsoft-com:vml"
    xmlns:wp14="http://schemas.microsoft.com/office/2010/word/wordprocessingDrawing"
    xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
    xmlns:w10="urn:schemas-microsoft-com:office:word"
    xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
    xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
    xmlns:wpi="http://schemas.microsoft.com/office/2010/wordprocessingInk"
    xmlns:wne="http://schemas.microsoft.com/office/2006/wordml"
    xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">
    <w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
  </w:document>`;
}
async function buildDocxBuffer(pages){
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  </Types>`);
  zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  </Relationships>`);
  zip.folder('word').file('document.xml', buildDocxXml(pages));
  return zip.generateAsync({ type: 'nodebuffer' });
}
/* ======================================= */

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { session_id, product, toEmail, applicantName, licensureType, pages } = req.body || {};
    if (!session_id)   return res.status(400).json({ ok:false, error:'Missing session_id' });
    if (!toEmail)      return res.status(400).json({ ok:false, error:'Missing toEmail' });
    if (!Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ ok:false, error:'Missing document pages' });
    }

    // 1) Verify Stripe payment
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (!session || session.payment_status !== 'paid') {
      return res.status(402).json({ ok:false, error:'Payment not completed' });
    }

    // Prefer Stripe email if present
    const sendTo = (session.customer_details && session.customer_details.email) || toEmail;

    // 2) Build server-side DOCX
    const docxBuffer = await buildDocxBuffer(pages);
    const safeName = (applicantName || 'APPLICANT').replace(/[^a-z0-9\- ]+/gi,'_');
    const type = licensureType || 'RN';
    const filename = `${safeName}_${type}_Appeal_Pack.docx`;

    // 3) Email via Brevo
    const apiInstance = new TransactionalEmailsApi();
    apiInstance.setApiKey(0, process.env.BREVO_API_KEY);

    const email = new SendSmtpEmail();
    email.sender = { email: process.env.FROM_EMAIL, name: 'Fast Legal Templates' };
    email.to = [{ email: sendTo }];
    email.subject = `Your ${product || 'Nursing Appeal Pack'} (.DOCX attached)`;
    email.htmlContent = `
      <p>Thanks for your purchase.</p>
      <p>Your personalized <strong>${product || 'Appeal Pack'}</strong> is attached as a single .DOCX.</p>
      <p>If you need changes, reply to this email and we’ll help.</p>
    `;
    email.attachment = [{
      name: filename,
      content: docxBuffer.toString('base64')
    }];

    await apiInstance.sendTransacEmail(email);

    return res.status(200).json({ ok:true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok:false, error: err?.message || 'Server error' });
  }
};
