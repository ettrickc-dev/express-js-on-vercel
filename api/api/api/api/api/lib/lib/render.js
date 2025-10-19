// lib/render.js
import { Document, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';

export async function renderPaidZip(draft) {
  const name = draft.name || 'Applicant';
  const type = draft.licensureType || 'RN';
  const state = draft.boardState || '[State]';
  const reason = draft.denialReason || '[Reason]';

  const sections = [
    {
      title: 'Appeal Letter',
      body: [
        `Applicant: ${name}`,
        `Licensure Type: ${type}`,
        `State Board: ${state}`,
        `Email: ${draft.email || ''}`,
        '',
        'Dear Board Members,',
        'This is my formal appeal and request for hearing...'
      ].join('\n')
    },
    {
      title: 'Appeal Memorandum',
      body: [
        `Issue: ${reason}`,
        '',
        'I. Introduction',
        'II. Facts & Application History',
        'III. Issues Presented',
        'IV. Evidence of Rehabilitation & Fitness'
      ].join('\n')
    },
    {
      title: 'Exhibits Index',
      body: [
        'Exhibit A — Denial Notice',
        'Exhibit B — Education / NCLEX',
        'Exhibit C — References',
        'Exhibit D — CEUs / Remediation',
        'Exhibit E — Character Letters'
      ].join('\n')
    },
    {
      title: 'Procedural Guide (Do Not File)',
      body: [
        'Checklist:',
        '- Calendar deadline from denial letter',
        '- File appeal to the correct body',
        '- Exchange disclosures',
        '- Prepare hearing script'
      ].join('\n')
    }
  ];

  const zip = new JSZip();

  for (const s of sections) {
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: s.title, bold: true, size: 28 })] }),
          new Paragraph(''),
          ...s.body.split('\n').map(line => new Paragraph(line))
        ]
      }]
    });
    const buffer = await Packer.toBuffer(doc);
    zip.file(`${s.title} - ${name}.docx`, buffer);
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  return {
    buffer: zipBuffer,
    filename: `${name}_${type}_Appeal_Pack.zip`,
    mime: 'application/zip'
  };
}
