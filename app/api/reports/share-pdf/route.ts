import { NextRequest, NextResponse } from 'next/server';
import { GET as getScanReport } from '../../asset-register/scan-report/route';
import { GET as getRegisterExport } from '../../asset-register/export/route';
import { GET as getMaintenanceReport } from '../../maintenance/report/route';
import { GET as getOwnershipReport } from '../../my-invoices/report/route';
import { buildBrandedReportPdfFromHtml } from '../../../../lib/branded-report-pdf';
import { getOwnerAppAccess, ownerAppCanAccessAsset } from '../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SharePdfSource = 'scan' | 'maintenance' | 'ownership' | 'valuation';

const SOURCE_PATHS: Record<SharePdfSource, string> = {
  scan: '/api/asset-register/scan-report',
  maintenance: '/api/maintenance/report',
  ownership: '/api/my-invoices/report',
  valuation: '/api/asset-register/export',
};

const SOURCE_HANDLERS: Record<SharePdfSource, (request: NextRequest) => Promise<Response>> = {
  scan: getScanReport,
  maintenance: getMaintenanceReport,
  ownership: getOwnershipReport,
  valuation: getRegisterExport,
};

function parseSource(value: string | null): SharePdfSource | null {
  return value === 'scan' || value === 'maintenance' || value === 'ownership' || value === 'valuation' ? value : null;
}

function safePdfFileName(disposition: string | null, fallback = 'aim4price-report.pdf'): string {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
  let source = fallback;

  try {
    source = encoded ? decodeURIComponent(encoded) : plain || fallback;
  } catch {
    source = plain || fallback;
  }

  const stem = source
    .replace(/\.(?:html?|pdf)$/i, '')
    .replace(/[\r\n"\\/]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140) || 'aim4price-report';
  return `${stem}.pdf`;
}

function reportTitleFromFileName(fileName: string): string {
  const words = fileName
    .replace(/\.pdf$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  return words.length
    ? words.map((word) => word.toLowerCase() === 'aim4price'
      ? 'Aim4price'
      : `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ')
    : 'Aim4price Report';
}

function buildForwardedRequest(request: NextRequest, source: SharePdfSource): NextRequest {
  const url = request.nextUrl.clone();
  url.pathname = SOURCE_PATHS[source];
  url.searchParams.delete('source');
  if (source === 'valuation') {
    const assetId = String(url.searchParams.get('assetId') ?? '').trim();
    url.searchParams.delete('assetId');
    url.searchParams.set('assetIds', assetId);
  }
  // The normal report handlers use `pdf` for their polished print view. The
  // adapter renders that same view into a binary PDF attachment.
  url.searchParams.set('format', 'pdf');

  return new NextRequest(url, {
    method: 'GET',
    headers: request.headers,
  });
}

async function enforceManagedOwnerAssetScope(request: NextRequest): Promise<NextResponse | null> {
  const access = await getOwnerAppAccess();
  if (!access || access.sessionKind !== 'owner-app-user') return null;

  const assetId = String(request.nextUrl.searchParams.get('assetId') ?? '').trim();
  const groupId = String(request.nextUrl.searchParams.get('groupId') ?? '').trim();
  if (groupId || !assetId || !ownerAppCanAccessAsset(access, assetId)) {
    return NextResponse.json({ ok: false, error: 'Report not found.' }, { status: 404 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const source = parseSource(request.nextUrl.searchParams.get('source'));
  if (!source) {
    return NextResponse.json(
      { ok: false, error: 'Choose a valid Aim4price report source.' },
      { status: 400 },
    );
  }

  try {
    const ownerAppScopeError = await enforceManagedOwnerAssetScope(request);
    if (ownerAppScopeError) return ownerAppScopeError;

    const reportResponse = await SOURCE_HANDLERS[source](buildForwardedRequest(request, source));
    if (!reportResponse.ok) return reportResponse;

    const contentType = String(reportResponse.headers.get('content-type') ?? '').toLowerCase();
    if (source === 'valuation' && contentType.includes('application/pdf')) {
      const fileName = safePdfFileName(reportResponse.headers.get('content-disposition'), 'aim4price-valuation.pdf');
      const pdf = await reportResponse.arrayBuffer();
      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': String(pdf.byteLength),
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    if (!contentType.includes('text/html')) {
      return NextResponse.json(
        { ok: false, error: 'The selected Aim4price report could not be prepared as a PDF.' },
        { status: 502 },
      );
    }

    const html = await reportResponse.text();
    const fileName = safePdfFileName(reportResponse.headers.get('content-disposition'));
    const pdf = buildBrandedReportPdfFromHtml(html, {
      title: reportTitleFromFileName(fileName),
      subtitle: 'Prepared from the standard Aim4price report',
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Aim4price share PDF generation failed.', error);
    return NextResponse.json(
      { ok: false, error: 'The selected Aim4price report could not be prepared as a PDF.' },
      { status: 500 },
    );
  }
}
