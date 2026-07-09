import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterReportLogoUrl } from '../../../../lib/asset-registers';
import {
  listAssetMaintenanceData,
  type AssetMaintenanceAssetOption,
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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReportFormat = 'pdf' | 'xlsx';
type ReportScope = 'total' | 'asset' | 'upcoming' | 'done';

function parseFormat(value: string | null): ReportFormat {
  return String(value ?? '').toLowerCase() === 'xlsx' ? 'xlsx' : 'pdf';
}

function parseScope(value: string | null): ReportScope {
  if (value === 'asset' || value === 'upcoming' || value === 'done') return value;
  return 'total';
}

function parseType(value: string | null): AssetMaintenanceType | 'all' | null {
  if (value === 'service' || value === 'checkup') return value;
  return null;
}

function parseStatus(value: string | null): 'upcoming' | 'done' | 'all' | null {
  if (value === 'upcoming' || value === 'done') return value;
  return null;
}

function parseFilters(request: NextRequest, scope: ReportScope): AssetMaintenanceListFilters {
  const searchParams = request.nextUrl.searchParams;
  const assetId = searchParams.get('assetId');
  const assignedTo = searchParams.get('assignedTo');

  return {
    assetId: assetId && assetId !== 'all' ? assetId : null,
    type: parseType(searchParams.get('type')),
    status: scope === 'upcoming' ? 'upcoming' : scope === 'done' ? 'done' : parseStatus(searchParams.get('status')),
    assignedTo: assignedTo && assignedTo !== 'all' ? assignedTo : null,
  };
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
  if (scope === 'done') return 'Done maintenance report';
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
    const [data, profile, rawLogoUrl] = await Promise.all([
      listAssetMaintenanceData(userId, filters),
      getAccountProfile({ id: userId, name: session.user.name, email: session.user.email }),
      getAssetRegisterReportLogoUrl(userId),
    ]);
    const logoUrl = await resolveReportLogoUrlForHtml(rawLogoUrl, request.url);

    const selectedAsset = findSelectedAsset(data.assets, filters);
    const ownerDetails = buildAssetMaintenanceOwnerDetails(profile, session.user);
    const scopeLabel = reportScopeLabel(scope, selectedAsset);
    const assetLabel = selectedAsset ? selectedAsset.title : 'All selected assets';
    const options = {
      title: 'Asset Maintenance Report',
      subtitle: 'Aim4price maintenance timeline',
      generatedAt: formatGeneratedDate(),
      ownerEmail: ownerDetails.businessEmail || session.user.email || '',
      ownerDetails,
      logoUrl,
      reportScopeLabel: scopeLabel,
      assetLabel,
      selectedAsset,
      summary: data.summary,
      records: data.records,
      xlsxUrl: buildFormatUrl(request, 'xlsx'),
    };

    const filename = `${slugify(`${scopeLabel}-${assetLabel}`)}.${format === 'xlsx' ? 'xlsx' : 'html'}`;

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

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${formatForHeader(filename)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Aim4price Asset Maintenance report failed.', error);
    return NextResponse.json({ ok: false, error: 'The Asset Maintenance report could not be generated.' }, { status: 500 });
  }
}
