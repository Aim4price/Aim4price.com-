import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getAssetRegisterReportLogoUrl } from '../../../../lib/asset-registers';
import { calculateMyInvoiceSummary, listMyInvoicesData, type MyInvoiceAssetOption, type MyInvoiceListFilters } from '../../../../lib/my-invoices';
import {
  buildMyInvoicesOwnerDetails,
  buildMyInvoicesReportHtml,
  buildMyInvoicesWorkbook,
} from '../../../../lib/my-invoices-report';
import {
  buildCostLedgerAccountingCsv,
  getCostLedgerAccountingSettings,
} from '../../../../lib/my-invoices-accounting';
import { createXlsxWorkbook } from '../../../../lib/simple-xlsx';
import { resolveReportLogoUrlForHtml } from '../../../../lib/report-logo';
import { getDealerTrackedAsset } from '../../../../lib/dealer-maintenance-tracker';
import { getAssetGroupById } from '../../../../lib/asset-groups';
import { filterCostLedgerForWorkspace, resolveOwnerWorkspaceContext } from '../../../../lib/owner-workspace-access';
import { getOwnerAppAccess, ownerAppCanAccessAsset } from '../../../../lib/owner-app-access';
import { renderReportHtmlToPdf } from '../../../../lib/report-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReportFormat = 'pdf' | 'xlsx' | 'csv' | 'html';

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPORT_NAME = 'Cost of Ownership Report';

function parseYear(value: string | null): number | null {
  if (!value || value === 'all') return null;
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : null;
}

function parseMonth(value: string | null): number | null {
  if (!value || value === 'all') return null;
  if (!/^\d{1,2}$/.test(value)) return null;
  const month = Number(value);
  return month >= 1 && month <= 12 ? month : null;
}

function parseFormat(value: string | null): ReportFormat {
  const format = String(value ?? '').toLowerCase();
  if (format === 'xlsx' || format === 'csv' || format === 'html') return format;
  return 'pdf';
}

function parseIncludeFuelSlipCosts(value: string | null): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized !== 'false' && normalized !== '0' && normalized !== 'no';
}

function parseFilters(request: NextRequest): MyInvoiceListFilters {
  const searchParams = request.nextUrl.searchParams;
  const assetId = searchParams.get('assetId');

  return {
    assetId: assetId && assetId !== 'all' ? assetId : null,
    year: parseYear(searchParams.get('year')),
    month: parseMonth(searchParams.get('month')),
    includeFuelSlipCosts: parseIncludeFuelSlipCosts(searchParams.get('includeFuelSlipCosts')),
  };
}

function dateRangeLabel(filters: MyInvoiceListFilters): string {
  if (filters.year && filters.month) {
    return `${MONTH_LABELS[filters.month - 1]} ${filters.year}`;
  }

  if (filters.year) return String(filters.year);
  return 'All available entries';
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

  return slug || 'cost-of-ownership-report';
}

function buildFormatUrl(request: NextRequest, format: ReportFormat): string {
  const nextUrl = request.nextUrl.clone();
  nextUrl.searchParams.set('format', format);
  return `${nextUrl.pathname}${nextUrl.search}`;
}

function findSelectedAsset(assets: MyInvoiceAssetOption[], filters: MyInvoiceListFilters): MyInvoiceAssetOption | null {
  if (!filters.assetId) return null;
  return assets.find((asset) => asset.id === filters.assetId) ?? null;
}

export async function GET(request: NextRequest) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'cost' });
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;

  try {
    const filters = parseFilters(request);
    const groupId = String(request.nextUrl.searchParams.get('groupId') ?? '').trim();
    const dealerAccessId = String(request.nextUrl.searchParams.get('accessId') ?? '').trim();
    const ownerAppAccess = await getOwnerAppAccess();

    if (
      ownerAppAccess?.sessionKind === 'owner-app-user'
      && (!filters.assetId || Boolean(groupId) || !ownerAppCanAccessAsset(ownerAppAccess, filters.assetId))
    ) {
      return NextResponse.json(
        { ok: false, error: 'The requested asset report could not be found.' },
        { status: 404 },
      );
    }

    let reportOwnerUserId = workspace.ownerUserId;
    let ownerFallbackUser: { name?: unknown; email?: unknown } = workspace.accountantAccess
      ? { name: workspace.accountantAccess.ownerName, email: '' }
      : { name: workspace.actorName, email: workspace.actorEmail };

    if (dealerAccessId) {
      if (groupId) {
        return NextResponse.json({ ok: false, error: 'Dealer report access supports one asset at a time.' }, { status: 400 });
      }
      if (workspace.accountantAccess) {
        return NextResponse.json({ ok: false, error: 'Dealer report access cannot be combined with an accountant workspace.' }, { status: 400 });
      }
      if (!UUID_PATTERN.test(dealerAccessId)) {
        return NextResponse.json({ ok: false, error: 'Cost of Ownership access is invalid.' }, { status: 400 });
      }

      const trackedAsset = await getDealerTrackedAsset(workspace.actorUserId, dealerAccessId);
      if (!trackedAsset || !trackedAsset.permissions.canViewCostOfOwnership) {
        return NextResponse.json({ ok: false, error: 'Cost of Ownership access is no longer active for this asset.' }, { status: 403 });
      }

      reportOwnerUserId = trackedAsset.ownerUserId;
      filters.assetId = trackedAsset.assetId;
      ownerFallbackUser = {
        name: trackedAsset.ownerName,
        email: trackedAsset.ownerEmail,
      };
    }

    const group = groupId ? await getAssetGroupById(reportOwnerUserId, groupId) : null;
    if (groupId && !group) {
      return NextResponse.json({ ok: false, error: 'Umbrella not found.' }, { status: 404 });
    }

    if (group) filters.assetId = null;

    const ownerAppMode = request.nextUrl.searchParams.get('source') === 'owner-app';
    const requestedFormat = parseFormat(request.nextUrl.searchParams.get('format'));
    // Owner App users may receive the same canonical PDF or workbook as the
    // normal report picker. Keep CSV/HTML private to the full workspace.
    const format = ownerAppMode && requestedFormat !== 'xlsx' ? 'pdf' : requestedFormat;
    const [unfilteredData, profile, rawLogoUrl] = await Promise.all([
      listMyInvoicesData(reportOwnerUserId, filters),
      getAccountProfile({
        id: reportOwnerUserId,
        name: String(ownerFallbackUser.name ?? ''),
        email: String(ownerFallbackUser.email ?? ''),
      }),
      getAssetRegisterReportLogoUrl(reportOwnerUserId),
    ]);
    const workspaceData = await filterCostLedgerForWorkspace(workspace, unfilteredData);
    const groupMemberIds = new Set(group?.members.map((member) => member.assetId) ?? []);
    const data = group
      ? {
          assets: workspaceData.assets.filter((asset) => groupMemberIds.has(asset.id)),
          invoices: workspaceData.invoices.filter((invoice) => groupMemberIds.has(invoice.assetId)),
          summary: calculateMyInvoiceSummary(
            workspaceData.invoices.filter((invoice) => groupMemberIds.has(invoice.assetId)),
          ),
        }
      : workspaceData;
    const reportLogoUrl = group ? String(profile.logoUrl ?? '').trim() || rawLogoUrl : rawLogoUrl;
    const logoUrl = await resolveReportLogoUrlForHtml(reportLogoUrl, request.url);

    const selectedAsset = group ? null : findSelectedAsset(data.assets, filters);
    const ownerDetails = buildMyInvoicesOwnerDetails(profile, ownerFallbackUser);
    const assetLabel = group?.name ?? selectedAsset?.title ?? 'All selected assets';
    const options = {
      title: group ? `${group.name} - ${REPORT_NAME}` : REPORT_NAME,
      subtitle: group ? 'Aim4price umbrella report' : 'Aim4price asset register',
      generatedAt: formatGeneratedDate(),
      ownerEmail: ownerDetails.businessEmail || String(ownerFallbackUser.email ?? ''),
      ownerDetails,
      logoUrl,
      dateRangeLabel: dateRangeLabel(filters),
      assetLabel,
      selectedAsset,
      summary: data.summary,
      invoices: data.invoices,
      includeFuelSlipCosts: filters.includeFuelSlipCosts !== false,
      xlsxUrl: buildFormatUrl(request, 'xlsx'),
      hideXlsx: ownerAppMode,
    };

    const extension = format;
    const filename = group
      ? `${slugify(group.name)}-cost-of-ownership.${extension}`
      : ownerAppMode
        ? `${slugify(options.assetLabel)}-cost-of-ownership.${extension}`
        : `${slugify(options.title)}.${extension}`;

    if (format === 'csv') {
      const settings = await getCostLedgerAccountingSettings(reportOwnerUserId);
      const accountingExport = buildCostLedgerAccountingCsv(
        data.invoices,
        settings,
        request.nextUrl.searchParams.get('accountingSoftware'),
      );

      if (!settings.configured || accountingExport.issues.length) {
        return NextResponse.json(
          {
            ok: false,
            error: !settings.configured
              ? 'Complete Accounting CSV Settings before downloading this file.'
              : 'Some cost records need attention before the accounting CSV can be downloaded.',
            issues: accountingExport.issues,
            configured: settings.configured,
            software: accountingExport.software,
            softwareLabel: accountingExport.softwareLabel,
          },
          { status: 422 },
        );
      }

      return new NextResponse(accountingExport.csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${formatForHeader(filename)}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format === 'xlsx') {
      const workbook = buildMyInvoicesWorkbook(options);
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

    const html = buildMyInvoicesReportHtml(options);

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
    console.error('Aim4price My Cost Ledger report failed.', error);
    return NextResponse.json({ ok: false, error: 'The Cost of Ownership report could not be generated.' }, { status: 500 });
  }
}
