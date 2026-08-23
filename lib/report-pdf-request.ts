export const MAX_REPORT_PDF_HTML_BYTES = 32 * 1024 * 1024;
export const MAX_REPORT_PDF_REQUEST_BYTES = MAX_REPORT_PDF_HTML_BYTES + (64 * 1024);

export type ReportPdfRenderRequest = {
  html: string;
  fileName: string;
};

export class ReportPdfRequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ReportPdfRequestError';
    this.status = status;
  }
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isCanonicalAim4priceReportHtml(value: string): boolean {
  return /<!doctype html>/i.test(value)
    && /<main\s+class=(?:"[^"]*\b(?:assetReportPage|fullRegisterPage)\b[^"]*"|'[^']*\b(?:assetReportPage|fullRegisterPage)\b[^']*')/i.test(value);
}

export function reportPdfRequestExceedsDeclaredLimit(value: string | null): boolean {
  if (!value || !/^\d+$/.test(value.trim())) return false;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > MAX_REPORT_PDF_REQUEST_BYTES;
}

export function normaliseReportPdfFileName(value: string): string {
  const cleaned = String(value ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\-\s]+|\.+$/g, '')
    .slice(0, 180);
  const withoutExtension = cleaned.replace(/\.pdf$/i, '').replace(/\.+$/g, '').trim();
  return `${withoutExtension || 'aim4price-report'}.pdf`;
}

export function parseReportPdfRenderRequest(bodyText: string): ReportPdfRenderRequest {
  if (utf8ByteLength(bodyText) > MAX_REPORT_PDF_REQUEST_BYTES) {
    throw new ReportPdfRequestError('The report is too large to prepare.', 413);
  }

  let value: unknown;
  try {
    value = JSON.parse(bodyText);
  } catch {
    throw new ReportPdfRequestError('The report request is not valid JSON.');
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReportPdfRequestError('The report request is invalid.');
  }

  const payload = value as Record<string, unknown>;
  if (typeof payload.html !== 'string' || !payload.html.trim()) {
    throw new ReportPdfRequestError('The report HTML is required.');
  }
  if (utf8ByteLength(payload.html) > MAX_REPORT_PDF_HTML_BYTES) {
    throw new ReportPdfRequestError('The report is too large to prepare.', 413);
  }
  if (!isCanonicalAim4priceReportHtml(payload.html)) {
    throw new ReportPdfRequestError('Only an Aim4price report created by the standard report flow can be prepared.');
  }
  if (typeof payload.fileName !== 'string' || payload.fileName.length > 512) {
    throw new ReportPdfRequestError('The report filename is invalid.');
  }

  return {
    // Do not trim, rebuild or otherwise transform this markup. It is the exact
    // document produced by lib/report-print and is rendered by the same PDF
    // pipeline as the normal Aim4price reports.
    html: payload.html,
    fileName: normaliseReportPdfFileName(payload.fileName),
  };
}
