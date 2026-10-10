import { NextRequest, NextResponse } from 'next/server';
import { resolveAppMaintenanceAccess, type MaintenanceApp } from './app-maintenance-access';
import { ExternalLeadAccessError } from './external-lead-access';
import { isTrustedRequestOrigin } from './trusted-request-origin';
import { changeAssetChecklistItem, addAssetChecklistItem, listAssetChecklistItems, removeAssetChecklistItem } from './asset-checklist-db';
import { getAssetRegisterItemById } from './asset-register-db';
import { getMaintenanceCatalogue } from './maintenance-catalogue-db';
import { checklistOptions, resolveMaintenanceChecklist } from './maintenance-catalogue';
import { buildAssetChecklistReportHtml } from './asset-checklist-report';
import { formatResolvedAssetUsage, resolveAssetUsage } from './asset-usage';
import { renderReportHtmlToPdf } from './report-pdf';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export async function appMaintenanceChecklist(request: NextRequest, app: MaintenanceApp, id: string) {
  try {
    const access = await resolveAppMaintenanceAccess(request, app, id);
    const writing = request.method !== 'GET';
    if (writing && (!access.canEdit || !isTrustedRequestOrigin(request.headers.get('origin'), request.nextUrl.origin))) throw new ExternalLeadAccessError('You do not have permission to change this checklist.', 403);
    const checkAccess = async () => {
      const fresh = await resolveAppMaintenanceAccess(request, app, id);
      if (!fresh.canEdit || ((request.method === 'PATCH' || request.method === 'DELETE') && !fresh.canRemove) || fresh.ownerId !== access.ownerId || fresh.assetId !== access.assetId) throw new ExternalLeadAccessError('Your access has changed. Reopen the checklist.', 403);
    };
    if (request.method === 'PATCH') {
      if (!access.canRemove) throw new ExternalLeadAccessError('Only the asset owner can edit or delete existing checklist items.', 403);
      return NextResponse.json({ items: await changeAssetChecklistItem(access.ownerId, access.assetId, await request.json(), checkAccess) }, { headers });
    }
    if (request.method === 'POST') return NextResponse.json({ item: await addAssetChecklistItem(access.ownerId, access.assetId, await request.json(), checkAccess) }, { status: 201, headers });
    if (request.method === 'DELETE') {
      if (!access.canRemove) throw new ExternalLeadAccessError('Only the asset owner can remove saved checklist items.', 403);
      await removeAssetChecklistItem(access.ownerId, access.assetId, request.nextUrl.searchParams.get('itemId') || '', checkAccess);
      return NextResponse.json({ ok: true }, { headers });
    }
    const asset = await getAssetRegisterItemById(access.ownerId, access.assetId);
    if (!asset) throw new ExternalLeadAccessError('This asset is no longer available.', 404);
    const items = await listAssetChecklistItems(access.ownerId, access.assetId);
    const checklist = { ...resolveMaintenanceChecklist(asset, await getMaintenanceCatalogue()), customItems: items };
    if (request.nextUrl.searchParams.get('pdf') === '1') {
      const requested = new Set(request.nextUrl.searchParams.getAll('item'));
      const selected = (['checked', 'serviced', 'repaired'] as const).flatMap(mode => checklistOptions(checklist, mode).filter(item => (mode !== 'repaired' || item.id.startsWith('asset_custom_')) && requested.has(`${mode}:${item.id}`)).map(item => `${mode}:${item.id}`));
      if (!selected.length) throw new ExternalLeadAccessError('Choose at least one checklist item.', 400);
      const generatedDate = new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeZone: 'Africa/Johannesburg' }).format(new Date());
      const pdf = await renderReportHtmlToPdf(buildAssetChecklistReportHtml(asset, checklist, selected, { logoUrl: '', generatedDate }), { baseUrl: request.url, cookie: request.headers.get('cookie') || '' });
      return new NextResponse(pdf, { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="maintenance-checklist.pdf"' } });
    }
    return NextResponse.json({ items, asset: { id: asset.id, title: asset.title, headerMeta: `Year Model: ${asset.yearModel || 'Not recorded'} · Usage: ${formatResolvedAssetUsage(resolveAssetUsage(asset))} · Condition: ${asset.condition || 'Not recorded'}`, maintenanceIdentity: checklist.family }, canEdit: access.canEdit, canRemove: access.canRemove, canRecord: access.canRecord, canSchedule: access.canSchedule }, { headers });
  } catch (error) {
    if (error instanceof ExternalLeadAccessError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    const message = error instanceof Error ? error.message : '';
    if (error instanceof SyntaxError || /^(Choose inspection|Enter an item|Keep instructions|This asset already)/.test(message)) return NextResponse.json({ error: error instanceof SyntaxError ? 'Invalid checklist item.' : message }, { status: 400, headers });
    if (message === 'ITEM_CHANGED') return NextResponse.json({ error: 'This item changed. Cancel and reopen it to try again.' }, { status: 409, headers });
    if (message === 'ASSET_NOT_FOUND' || message === 'ITEM_NOT_FOUND') return NextResponse.json({ error: 'The asset or checklist item is no longer available.' }, { status: 404, headers });
    console.error('App checklist request failed.', error);
    return NextResponse.json({ error: 'Could not load or save this checklist. Please try again.' }, { status: 503, headers });
  }
}
