import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { renderReportHtmlToPdf } from '../../../../lib/report-pdf';
import {
  MAX_REPORT_PDF_REQUEST_BYTES,
  parseReportPdfRenderRequest,
  ReportPdfRequestError,
  reportPdfRequestExceedsDeclaredLimit,
} from '../../../../lib/report-pdf-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json(
    { ok: false, error },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}

async function readBoundedRequestText(request: NextRequest): Promise<string> {
  if (!request.body) return '';

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_REPORT_PDF_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new ReportPdfRequestError('The report is too large to prepare.', 413);
      }

      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join('');
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession({ requireActive: true, allowOwnerApp: true });
  const userId = session?.user?.id ?? '';

  if (!session || !userId) {
    return errorResponse('You must be signed in to prepare a report.', 401);
  }

  const contentType = String(request.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.split(';', 1)[0]?.trim() !== 'application/json') {
    return errorResponse('The report request must be JSON.', 415);
  }

  if (reportPdfRequestExceedsDeclaredLimit(request.headers.get('content-length'))) {
    return errorResponse('The report is too large to prepare.', 413);
  }

  try {
    const payload = parseReportPdfRenderRequest(await readBoundedRequestText(request));
    const pdf = await renderReportHtmlToPdf(payload.html, {
      baseUrl: request.url,
      cookie: request.headers.get('cookie') ?? '',
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.length),
        'Content-Disposition': `attachment; filename="${payload.fileName}"`,
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    if (error instanceof ReportPdfRequestError) {
      return errorResponse(error.message, error.status);
    }

    console.error('Failed to render shared Aim4price report:', error);
    return errorResponse('The report could not be prepared. Please try again.', 503);
  }
}
