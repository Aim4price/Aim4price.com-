/** Combine photos of one invoice locally; the server still receives one validated document. */
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_PAGES = 12;
const TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export function validateInvoicePages(files: File[]): string | null {
  if (!files.length) return 'Choose an invoice before continuing.';
  if (files.length > MAX_PAGES) return 'Choose up to 12 photos of one invoice.';
  if (files.some((file) => !TYPES.has(file.type))) return 'Only PDF, JPG, PNG and WEBP files are accepted.';
  if (files.some((file) => !file.size || file.size > MAX_BYTES)) return 'Each file must be between 1 byte and 12 MB.';
  if (files.length > 1 && files.some((file) => file.type === 'application/pdf')) return 'Choose one PDF, or photos of the same invoice.';
  if (files.reduce((sum, file) => sum + file.size, 0) > 48 * 1024 * 1024) return 'Choose photos totalling 48 MB or less.';
  return null;
}

export async function prepareInvoiceUpload(files: File[]): Promise<File> {
  const error = validateInvoicePages(files);
  if (error) throw new Error(error);
  if (files.length === 1) return files[0];
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  for (const file of files) {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('These photos could not be prepared. Try a PDF instead.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error('A photo could not be prepared.')),
        'image/jpeg', 0.9,
      ));
      const image = await pdf.embedJpg(await blob.arrayBuffer());
      const page = pdf.addPage([canvas.width, canvas.height]);
      page.drawImage(image, { x: 0, y: 0, width: canvas.width, height: canvas.height });
      canvas.width = 0; canvas.height = 0;
    } finally { bitmap.close(); }
  }
  const bytes = await pdf.save();
  if (bytes.byteLength > MAX_BYTES) throw new Error('The combined invoice exceeds 12 MB. Use smaller photos.');
  return new File([bytes], 'invoice-pages.pdf', { type: 'application/pdf' });
}
