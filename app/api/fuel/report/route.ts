import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getAssetRegisterReportLogoUrl } from '../../../../lib/asset-registers';
import { getFuelStorageById, listFuelEventsForReport, listFuelLedger } from '../../../../lib/fuel-ledger';
import { createXlsxWorkbook } from '../../../../lib/simple-xlsx';
import { resolveReportLogoUrlForHtml } from '../../../../lib/report-logo';
import {
  filterFuelLedgerForWorkspace,
  getWorkspaceAssetIds,
  resolveOwnerWorkspaceContext,
} from '../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { asText, parseReportYear, parseReportMonth, parseReportFormat, buildReportDateRange, buildOwnerReportDetails, buildFormatUrl, slugifyFileSegment, buildReportHtml, buildFuelWorkbook, type FuelReportOptions } from '../../../../lib/fuel-report';

export async function GET(request: NextRequest) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;

  const params = request.nextUrl.searchParams;
  const storageId = asText(params.get('storageId'));
  const assetId = asText(params.get('assetId'));
  const year = parseReportYear(asText(params.get('year')));
  const month = year ? parseReportMonth(asText(params.get('month'))) : null;
  const format = parseReportFormat(asText(params.get('format')));
  const includeFuelSlips = asText(params.get('includeFuelSlips')).toLowerCase() !== 'false';
  const dateRange = buildReportDateRange(year, month);

  try {
    const [unfilteredLedger, unfilteredEvents, storage, workspaceAssetIds] = await Promise.all([
      listFuelLedger(workspace.ownerUserId),
      listFuelEventsForReport(workspace.ownerUserId, {
        storageId: storageId || undefined,
        fromIso: dateRange.fromIso,
        toIso: dateRange.toIso,
        includeFuelSlips,
      }),
      storageId ? getFuelStorageById(workspace.ownerUserId, storageId) : Promise.resolve(null),
      getWorkspaceAssetIds(workspace),
    ]);
    const ledger = await filterFuelLedgerForWorkspace(workspace, unfilteredLedger);
    const accessibleEvents = workspaceAssetIds
      ? unfilteredEvents.filter((event) => !event.assetId || workspaceAssetIds.has(event.assetId))
      : unfilteredEvents;

    const selectedAsset = assetId ? ledger.assets.find(asset=>asset.id === assetId) : null;
    if (assetId && !selectedAsset) return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    const events = assetId ? accessibleEvents.filter(event=>event.assetId === assetId) : accessibleEvents;

    if (storageId && !storage) {
      return NextResponse.json({ ok: false, error: 'Fuel storage not found.' }, { status: 404 });
    }

    const totalIssued = events
      .filter((event) => event.eventType === 'asset_issue')
      .reduce((sum, event) => sum + event.litres, 0);
    const totalWorkUseIssued = events
      .filter((event) => event.eventType === 'asset_issue' && !event.workUseExcluded)
      .reduce((sum, event) => sum + event.litres, 0);
    const totalExcludedIssued = events
      .filter((event) => event.eventType === 'asset_issue' && event.workUseExcluded)
      .reduce((sum, event) => sum + event.litres, 0);
    const totalStockIn = events
      .filter((event) => event.eventType === 'stock_in' || event.eventType === 'opening_balance')
      .reduce((sum, event) => sum + event.litres, 0);
    const ownerProfile = await getAccountProfile({
      id: workspace.ownerUserId,
      name: workspace.actorName,
      email: workspace.actorEmail,
    });
    const ownerDetails = buildOwnerReportDetails(ownerProfile, {
      name: workspace.actorName,
      email: workspace.actorEmail,
    });
    const ownerEmail = ownerDetails.businessEmail;
    const generatedAt = new Intl.DateTimeFormat('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Johannesburg',
    }).format(new Date());
    const storageName = storage ? storage.name : includeFuelSlips ? 'All storage units + slips' : 'All storage units';
    const storageFuelType = storage ? storage.fuelType.toUpperCase() : 'All fuel types';
    const storageCode = storage ? storage.publicFuelStorageCode : includeFuelSlips ? 'All storage QR codes + slips' : 'All storage QR codes';
    const title = selectedAsset ? `${selectedAsset.title} Fuel Report` : storage ? `${storage.name} Fuel Report` : includeFuelSlips ? 'Fuel Ledger Report' : 'Fuel Storage Report';
    const subtitle = selectedAsset ? `${selectedAsset.title} · ${dateRange.label}. Fuel issued to this asset; storage balances do not apply.` : storage
      ? includeFuelSlips
        ? `${storage.fuelType.toUpperCase()} storage and linked fuel slip report for ${dateRange.label}.`
        : `${storage.fuelType.toUpperCase()} storage report for ${dateRange.label}.`
      : includeFuelSlips
        ? `All fuel storage and fuel slip transactions for ${dateRange.label}.`
        : `All fuel storage transactions for ${dateRange.label}.`;
    const rawLogoUrl = await getAssetRegisterReportLogoUrl(workspace.ownerUserId, '', assetId).catch(() => '');
    const logoUrl = await resolveReportLogoUrlForHtml(rawLogoUrl, request.url);
    const reportOptions: FuelReportOptions = {
      baseUrl: request.url,
      assetTitle: selectedAsset?.title,
      title,
      subtitle,
      generatedAt,
      ownerEmail,
      ownerDetails,
      logoUrl,
      dateRangeLabel: dateRange.label,
      storageName,
      storageCode,
      storageFuelType,
      totalIssued,
      totalWorkUseIssued,
      totalExcludedIssued,
      totalStockIn,
      currentLitres: storage ? storage.currentLitres : ledger.summary.currentLitres,
      storageCount: storage ? 1 : ledger.summary.totalStorageUnits,
      eventCount: events.length,
      events,
      xlsxUrl: buildFormatUrl(request, 'xlsx'),
    };
    const filenameDate = new Date().toISOString().slice(0, 10);
    const baseFileName = `${slugifyFileSegment(title)}-${filenameDate}`;

    if (format === 'xlsx') {
      const workbook = createXlsxWorkbook(buildFuelWorkbook(reportOptions));

      return new NextResponse(workbook, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${baseFileName}.xlsx"`,
          'Content-Length': String(workbook.length),
          'Cache-Control': 'no-store',
        },
      });
    }

    const html = buildReportHtml(reportOptions);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-disposition': `inline; filename="${baseFileName}.html"`,
      },
    });
  } catch (error) {
    console.error('fuel report failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to build fuel report.' },
      { status: 500 },
    );
  }
}
