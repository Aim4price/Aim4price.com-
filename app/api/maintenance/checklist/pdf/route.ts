import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/auth-session';
import { listAssetChecklistItems } from '../../../../../lib/asset-checklist-db';
import { getAssetRegisterItemById } from '../../../../../lib/asset-register-db';
import { getMaintenanceCatalogue } from '../../../../../lib/maintenance-catalogue-db';
import { checklistOptions, resolveMaintenanceChecklist } from '../../../../../lib/maintenance-catalogue';
import { buildAssetChecklistReportHtml } from '../../../../../lib/asset-checklist-report';
import { getAssetRegisterReportLogoUrl } from '../../../../../lib/asset-registers';
import { resolveReportLogoUrlForHtml } from '../../../../../lib/report-logo';
import { renderReportHtmlToPdf } from '../../../../../lib/report-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession({ requireActive: true });
  const userId = session?.user?.id;
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!userId) return NextResponse.json({ error: 'Sign in to download your checklist.' }, { status: 401, headers });
  const assetId = request.nextUrl.searchParams.get('assetId') || '';
  try {
    const customItems = await listAssetChecklistItems(userId, assetId);
    const asset = await getAssetRegisterItemById(userId, assetId);
    if (!asset) throw new Error('ASSET_NOT_FOUND');
    const catalogue = await getMaintenanceCatalogue();
    const checklist = { ...resolveMaintenanceChecklist(asset, catalogue), customItems };
    const requestedItems = new Set(request.nextUrl.searchParams.getAll('item'));
    const selectedItems = (['checked', 'serviced', 'repaired'] as const).flatMap(mode =>
      checklistOptions(checklist, mode)
        .filter(item => (mode !== 'repaired' || item.id.startsWith('asset_custom_')) && requestedItems.has(`${mode}:${item.id}`))
        .map(item => `${mode}:${item.id}`),
    );
    if (!selectedItems.length) return NextResponse.json({ error: 'Select at least one checklist item.' }, { status: 400, headers });
    const rawLogoUrl = await getAssetRegisterReportLogoUrl(userId, asset.registerId).catch(() => '');
    const logoUrl = await resolveReportLogoUrlForHtml(rawLogoUrl, request.url);
    const generatedDate = new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeZone: 'Africa/Johannesburg' }).format(new Date());
    const pdf = await renderReportHtmlToPdf(buildAssetChecklistReportHtml(asset, checklist, selectedItems, { logoUrl, generatedDate }), {
      baseUrl: request.url,
      cookie: request.headers.get('cookie') ?? '',
    });
    return new NextResponse(pdf, { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="maintenance-checklist.pdf"' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_NOT_FOUND') return NextResponse.json({ error: 'The asset could not be found for your account.' }, { status: 404, headers });
    console.error('Maintenance checklist PDF failed.', error);
    return NextResponse.json({ error: 'The checklist PDF could not be generated. Please try again.' }, { status: 503, headers });
  }
}
