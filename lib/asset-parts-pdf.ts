import { NextRequest, NextResponse } from 'next/server';
import { getAssetRegisterReportLogoUrl } from './asset-registers';
import { resolveReportLogoUrlForHtml } from './report-logo';
import { renderReportHtmlToPdf } from './report-pdf';
import { buildAssetPartsReportHtml } from './asset-parts-report';
import type { AssetPart, PartsData } from './asset-parts';

export async function assetPartsPdfResponse(request: NextRequest, ownerId: string, asset: { title: string; serialNumber?: string; registerId?: string | null }, parts: AssetPart[], maintenance: PartsData['maintenance']) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  try {
    const rawLogoUrl = await getAssetRegisterReportLogoUrl(ownerId, asset.registerId).catch(() => '');
    const logoUrl = await resolveReportLogoUrlForHtml(rawLogoUrl, request.url);
    const generatedDate = new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeZone: 'Africa/Johannesburg' }).format(new Date());
    const pdf = await renderReportHtmlToPdf(buildAssetPartsReportHtml(asset, parts, maintenance, { logoUrl, generatedDate }), { baseUrl: request.url, cookie: request.headers.get('cookie') ?? '' });
    return new NextResponse(pdf, { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="asset-parts.pdf"' } });
  } catch (error) {
    console.error('Parts PDF failed.', error);
    return NextResponse.json({ error: 'The parts PDF could not be generated. Please try again.' }, { status: 503, headers });
  }
}
