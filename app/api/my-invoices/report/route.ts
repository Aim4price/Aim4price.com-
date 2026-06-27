import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterReportLogoUrl } from '../../../../lib/asset-registers';
import { listMyInvoicesData, type MyInvoiceAssetOption, type MyInvoiceListFilters } from '../../../../lib/my-invoices';
import {
  buildMyInvoicesOwnerDetails,
  buildMyInvoicesReportHtml,
  buildMyInvoicesWorkbook,
} from '../../../../lib/my-invoices-report';
import { createXlsxWorkbook } from '../../../../lib/simple-xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReportFormat = 'pdf' | 'xlsx';

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
  return String(value ?? '').toLowerCase() === 'xlsx' ? 'xlsx' : 'pdf';
}

function parseFilters(request: NextRequest): MyInvoiceListFilters {
  const searchParams = request.nextUrl.searchParams;
  const assetId = searchParams.get('assetId');

  return {
    assetId: assetId && assetId !== 'all' ? assetId : null,
    year: parseYear(searchParams.get('year')),
    month: parseMonth(searchParams.get('month')),
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
  const session = await getServerSession({ requireActive: true });
  const userId = session?.user?.id ?? '';

  if (!session || !userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to export Cost of Ownership reports.' }, { status: 401 });
  }

  try {
    const filters = parseFilters(request);
    const format = parseFormat(request.nextUrl.searchParams.get('format'));
    const [data, profile, logoUrl] = await Promise.all([
      listMyInvoicesData(userId, filters),
      getAccountProfile({ id: userId, name: session.user.name, email: session.user.email }),
      getAssetRegisterReportLogoUrl(userId),
    ]);

    const selectedAsset = findSelectedAsset(data.assets, filters);
    const ownerDetails = buildMyInvoicesOwnerDetails(profile, session.user);
    const options = {
      title: 'Cost of Ownership Report',
      subtitle: 'Aim4price asset register',
      generatedAt: formatGeneratedDate(),
      ownerEmail: ownerDetails.businessEmail || session.user.email || '',
      ownerDetails,
      logoUrl,
      dateRangeLabel: dateRangeLabel(filters),
      assetLabel: selectedAsset ? selectedAsset.title : 'All selected assets',
      selectedAsset,
      summary: data.summary,
      invoices: data.invoices,
      xlsxUrl: buildFormatUrl(request, 'xlsx'),
    };

    const filename = `${slugify(options.assetLabel)}-cost-of-ownership.${format === 'xlsx' ? 'xlsx' : 'html'}`;

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

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${formatForHeader(filename)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Aim4price My Invoices report failed.', error);
    return NextResponse.json({ ok: false, error: 'The Cost of Ownership report could not be generated.' }, { status: 500 });
  }
}
