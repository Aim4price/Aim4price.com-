import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterReportLogoUrl } from '../../../../lib/asset-registers';
import {
  calculateAssetMaintenanceSummary,
  listAssetMaintenanceData,
  type AssetMaintenanceAssetOption,
  type AssetMaintenanceRecord,
  type AssetMaintenanceListFilters,
  type AssetMaintenanceType,
} from '../../../../lib/asset-maintenance';
import {
  buildAssetMaintenanceOwnerDetails,
  buildAssetMaintenanceReportHtml,
  buildAssetMaintenanceWorkbook,
} from '../../../../lib/asset-maintenance-report';
import { createXlsxWorkbook } from '../../../../lib/simple-xlsx';
import { resolveReportLogoUrlForHtml } from '../../../../lib/report-logo';
import { getAssetGroupById } from '../../../../lib/asset-groups';
import { renderReportHtmlToPdf } from '../../../../lib/report-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReportFormat = 'pdf' | 'xlsx' | 'html';
type ReportScope = 'total' | 'asset' | 'upcoming' | 'done';

function parseFormat(value: string | null): ReportFormat {
  const format = String(value ?? '').trim().toLowerCase();
  if (format === 'xlsx' || format === 'html') return format;
  return 'pdf';
}

function parseScope(value: string | null): ReportScope {
  if (value === 'asset' || value === 'upcoming' || value === 'done') return value;
  return 'total';
}

function parseType(value: string | null): AssetMaintenanceType | 'all' | null {
  if (value === 'service' || value === 'checkup') return value;
  return null;
}

function parseFilters(request: NextRequest, scope: ReportScope): AssetMaintenanceListFilters {
  const searchParams = request.nextUrl.searchParams;
  const assetId = searchParams.get('assetId');
  const assignedTo = searchParams.get('assignedTo');

  const reportStatus: AssetMaintenanceListFilters['status'] =
    scope === 'upcoming' ? 'upcoming' : scope === 'done' ? 'done' : 'all';

  return {
    assetId: assetId && assetId !== 'all' ? assetId : null,
    type: parseType(searchParams.get('type')),
    // "All" deliberately includes scheduled/open work and every persisted
    // completion, including stand-alone services, check-ups and repairs.
    status: reportStatus,
    assignedTo: assignedTo && assignedTo !== 'all' ? assignedTo : null,
  };
}

function parseReportYear(value: string | null): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2200 ? parsed : null;
}

function parseReportMonth(value: string | null): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}

function maintenanceRecordReportDate(record: AssetMaintenanceRecord): Date | null {
  const value = record.status === 'done'
    ? record.completedAtIso || record.updatedAtIso
    : record.dueDate || record.updatedAtIso;
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function filterRecordsByPeriod(records: AssetMaintenanceRecord[], year: number | null, month: number | null): AssetMaintenanceRecord[] {
  if (!year) return records;
  return records.filter((record) => {
    const date = maintenanceRecordReportDate(record);
    if (!date) return false;
    const recordYear = Number(new Intl.DateTimeFormat('en-ZA', { year: 'numeric', timeZone: 'Africa/Johannesburg' }).format(date));
    if (recordYear !== year) return false;
    if (!month) return true;
    const recordMonth = Number(new Intl.DateTimeFormat('en-ZA', { month: 'numeric', timeZone: 'Africa/Johannesburg' }).format(date));
    return recordMonth === month;
  });
}

function formatGeneratedDate(value = new Date()): string {
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  }).format(value);
}

function formatForHeader(value: string): string {
  return value.replace(/[\r\n"]/g, ' ').slice(0, 160);
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'asset-maintenance-report';
}

function buildFormatUrl(request: NextRequest, format: ReportFormat): string {
  const nextUrl = request.nextUrl.clone();
  nextUrl.searchParams.set('format', format);
  return `${nextUrl.pathname}${nextUrl.search}`;
}

function findSelectedAsset(
  assets: AssetMaintenanceAssetOption[],
  filters: AssetMaintenanceListFilters,
): AssetMaintenanceAssetOption | null {
  if (!filters.assetId) return null;
  return assets.find((asset) => asset.id === filters.assetId) ?? null;
}

function reportScopeLabel(scope: ReportScope, selectedAsset: AssetMaintenanceAssetOption | null): string {
  if (scope === 'asset') return selectedAsset ? `Specific asset maintenance report: ${selectedAsset.title}` : 'Specific asset maintenance report';
  if (scope === 'upcoming') return 'Upcoming maintenance report';
  if (scope === 'done') return 'Completed maintenance history report';
  return 'Total maintenance report';
}

export async function GET(request: NextRequest) {
  const session = await getServerSession({ requireActive: true });
  const userId = session?.user?.id ?? '';

  if (!session || !userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to export maintenance reports.' }, { status: 401 });
  }

  try {
    const scope = parseScope(request.nextUrl.searchParams.get('scope'));
    const filters = parseFilters(request, scope);
    const format = parseFormat(request.nextUrl.searchParams.get('format'));
    const groupId = String(request.nextUrl.searchParams.get('groupId') ?? '').trim();
    const reportYear = parseReportYear(request.nextUrl.searchParams.get('year'));
    const reportMonth = reportYear ? parseReportMonth(request.nextUrl.searchParams.get('month')) : null;
    const group = groupId ? await getAssetGroupById(userId, groupId) : null;

    if (groupId && !group) {
      return NextResponse.json({ ok: false, error: 'Umbrella not found.' }, { status: 404 });
    }
    if (group && filters.assetId) {
      return NextResponse.json({ ok: false, error: 'Choose either an umbrella or a single asset maintenance report.' }, { status: 400 });
    }

    const groupMemberAssetIds = group
      ? group.members.map((member) => member.assetId)
      : null;
    const [data, profile, rawLogoUrl] = await Promise.all([
      listAssetMaintenanceData(
        userId,
        group ? { ...filters, assetId: null } : filters,
        {
          includeCompletedScanHistory: true,
          completedScanHistoryAssetIds: groupMemberAssetIds ?? undefined,
        },
      ),
      getAccountProfile({ id: userId, name: session.user.name, email: session.user.email }),
      getAssetRegisterReportLogoUrl(userId),
    ]);
    const logoUrl = await resolveReportLogoUrlForHtml(rawLogoUrl, request.url);
    const groupMemberIds = groupMemberAssetIds ? new Set(groupMemberAssetIds) : null;
    const scopedRecords = groupMemberIds
      ? data.records.filter((record) => groupMemberIds.has(record.assetId))
      : data.records;
    const records = filterRecordsByPeriod(scopedRecords, reportYear, reportMonth);
    const selectedAsset = group ? null : findSelectedAsset(data.assets, filters);
    const ownerDetails = buildAssetMaintenanceOwnerDetails(profile, session.user);
    const baseScopeLabel = reportScopeLabel(scope, selectedAsset);
    const periodLabel = reportYear
      ? reportMonth
        ? new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' }).format(new Date(Date.UTC(reportYear, reportMonth - 1, 1)))
        : String(reportYear)
      : '';
    const scopeLabel = [baseScopeLabel, group ? `Umbrella: ${group.name}` : '', periodLabel].filter(Boolean).join(' · ');
    const assetLabel = group?.name || selectedAsset?.title || 'All selected assets';
    const options = {
      title: 'Asset Maintenance Report',
      subtitle: 'Aim4price asset register',
      generatedAt: formatGeneratedDate(),
      ownerEmail: ownerDetails.businessEmail || session.user.email || '',
      ownerDetails,
      logoUrl,
      reportScopeLabel: scopeLabel,
      assetLabel,
      selectedAsset,
      summary: calculateAssetMaintenanceSummary(records),
      records,
      xlsxUrl: buildFormatUrl(request, 'xlsx'),
    };

    const filename = `${slugify(`${scopeLabel}-${assetLabel}`)}.${format}`;

    if (format === 'xlsx') {
      const workbook = buildAssetMaintenanceWorkbook(options);
      const buffer = createXlsxWorkbook(workbook);

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${formatForHeader(filename)}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const html = buildAssetMaintenanceReportHtml(options);

    if (format === 'html') {
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="${formatForHeader(filename)}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const pdf = await renderReportHtmlToPdf(html, {
      baseUrl: request.url,
      cookie: request.headers.get('cookie') ?? '',
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.length),
        'Content-Disposition': `inline; filename="${formatForHeader(filename)}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Aim4price Asset Maintenance report failed.', error);
    return NextResponse.json({ ok: false, error: 'The Asset Maintenance report could not be generated.' }, { status: 500 });
  }
}
