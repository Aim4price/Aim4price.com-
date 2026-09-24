import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { EstimateBreakdown } from './estimate-breakdown';

export async function renderEstimateBreakdownPdf(report: EstimateBreakdown): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595.28, 841.89]);
  let y = 793;
  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, '-');
  const money = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ')}`;
  const room = (height: number) => { if (y - height < 55) { page = doc.addPage([595.28, 841.89]); y = 793; } };
  const text = (value: string, size = 10, strong = false) => {
    const face = strong ? bold : font;
    let line = '';
    for (const word of clean(value).split(' ')) {
      if (line && face.widthOfTextAtSize(`${line} ${word}`, size) > 499) {
        room(size + 7); page.drawText(line, { x: 48, y, font: face, size }); y -= size + 7; line = '';
      }
      // Bound unbroken model names as well as ordinary words.
      for (const char of (line ? ' ' : '') + word) {
        if (face.widthOfTextAtSize(line + char, size) > 499) {
          room(size + 7); page.drawText(line, { x: 48, y, font: face, size }); y -= size + 7; line = '';
        }
        line += char;
      }
    }
    if (line) { room(size + 7); page.drawText(line, { x: 48, y, font: face, size }); y -= size + 7; }
  };
  text('Aim4price | Estimate breakdown', 19, true);
  text(report.title, 12, true);
  text('All amounts exclude VAT. Percentages apply to the preceding balance.');
  text('Calculations retain precision until final rounding.');
  y -= 12;
  for (const row of report.rows) {
    room(52);
    page.drawLine({ start: { x: 48, y: y + 8 }, end: { x: 547, y: y + 8 }, thickness: 0.5, color: rgb(0.82, 0.86, 0.84) });
    text(`${row.label}${row.percent === null ? '' : ` (${row.percent >= 0 ? '+' : ''}${Number(row.percent.toFixed(4))}%)`}`, 10, true);
    const change = `${row.change < 0 ? '-' : '+'}${money(Math.abs(row.change))}`;
    text(`Change: ${change}     Balance: ${money(row.value)}`, 10);
    y -= 8;
  }
  room(55);
  y -= 5;
  text(`Final estimate: ${money(report.total)}`, 16, true);
  y -= 12;
  for (const note of report.notes) text(note, 9);
  y -= 10;
  text('Indicative estimate, not a certified appraisal or guaranteed selling price.', 9);
  doc.getPages().forEach((p, index) => p.drawText(`Aim4price - ${index + 1} / ${doc.getPageCount()}`, { x: 48, y: 28, font, size: 8 }));
  return doc.save();
}
