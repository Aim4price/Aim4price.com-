import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getFuelStorageById, listFuelEventsForReport, listFuelLedger, type FuelLedgerEvent } from '../../../../lib/fuel-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Johannesburg',
  }).format(date);
}

function formatLitres(value: number | null | undefined): string {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return '0 L';
  return `${parsed.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} L`;
}

function formatPercent(value: number | null | undefined): string {
  return value === null || typeof value === 'undefined' ? '—' : `${value}%`;
}

function formatLocation(event: FuelLedgerEvent): string {
  if (event.locationText) return event.locationText;
  if (event.latitude !== null && event.longitude !== null) {
    return `GPS ${event.latitude.toFixed(6)}, ${event.longitude.toFixed(6)}`;
  }
  return '—';
}

function eventTypeLabel(value: string): string {
  if (value === 'opening_balance') return 'Opening balance';
  if (value === 'stock_in') return 'Stock in';
  if (value === 'asset_issue') return 'Asset issue';
  if (value === 'dip') return 'Manual dip';
  return 'Adjustment';
}

function slugifyFileSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'fuel-ledger';
}

function parseReportYear(value: string): number | null {
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : null;
}

function parseReportMonth(value: string): number | null {
  if (!/^\d{1,2}$/.test(value)) return null;
  const month = Number(value);
  return month >= 1 && month <= 12 ? month : null;
}

function buildReportDateRange(year: number | null, month: number | null): { fromIso?: string; toIso?: string; label: string } {
  if (!year) {
    return { label: 'All available entries' };
  }

  if (month) {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));
    const label = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(from);
    return { fromIso: from.toISOString(), toIso: to.toISOString(), label };
  }

  return {
    fromIso: new Date(Date.UTC(year, 0, 1)).toISOString(),
    toIso: new Date(Date.UTC(year + 1, 0, 1)).toISOString(),
    label: String(year),
  };
}


function buildReportHtml(options: {
  title: string;
  subtitle: string;
  generatedAt: string;
  totalIssued: number;
  totalStockIn: number;
  currentLitres: number;
  storageCount: number;
  events: FuelLedgerEvent[];
}): string {
  const rows = options.events
    .map((event) => {
      const asset = event.assetTitle || event.assetPlateLabel || '—';
      return `<tr>
        <td>${escapeHtml(formatDateTime(event.createdAtIso))}</td>
        <td>${escapeHtml(eventTypeLabel(event.eventType))}</td>
        <td>${escapeHtml(event.storageName)}</td>
        <td>${escapeHtml(asset)}</td>
        <td class="num">${escapeHtml(formatLitres(event.litres))}</td>
        <td class="num">${escapeHtml(formatLitres(event.storageLevelBefore))}</td>
        <td class="num">${escapeHtml(formatLitres(event.storageLevelAfter))}</td>
        <td class="num">${escapeHtml(formatPercent(event.assetFuelPercentAfter))}</td>
        <td>${escapeHtml(event.operatorName || '—')}</td>
        <td>${escapeHtml(formatLocation(event))}</td>
        <td>${escapeHtml(event.note || '—')}</td>
      </tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&display=swap");

      :root {
        color-scheme: light;
        --brand: #10382f;
        --brand-mid: #165340;
        --muted: #617286;
        --line: #dce6ee;
        --paper: #ffffff;
        --soft: #f7fafc;
        --page: #eef3f5;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        padding: 30px;
        font-family: Montserrat, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(22, 83, 64, 0.08), transparent 30%),
          var(--page);
        color: #142f28;
      }

      .shell {
        width: min(100%, 1240px);
        margin: 0 auto;
        display: grid;
        gap: 18px;
      }

      .toolbar {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: flex-start;
        flex-wrap: wrap;
      }

      h1 {
        margin: 0;
        color: var(--brand);
        font-size: clamp(36px, 4.6vw, 58px);
        line-height: 0.95;
        letter-spacing: -0.065em;
      }

      .subtitle {
        max-width: 780px;
        margin: 8px 0 0;
        color: var(--muted);
        font-size: 15px;
        font-weight: 680;
        line-height: 1.55;
      }

      button {
        min-height: 52px;
        padding: 0 24px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, #ffffff 0%, #f2f7fb 100%);
        color: #173d31;
        font: inherit;
        font-size: 15px;
        font-weight: 850;
        cursor: pointer;
        box-shadow: 0 14px 28px rgba(18, 45, 37, 0.08);
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
      }

      .card {
        min-height: 98px;
        padding: 20px 22px;
        border-radius: 24px;
        border: 1px solid var(--line);
        background:
          radial-gradient(circle at top left, rgba(22, 83, 64, 0.04), transparent 40%),
          var(--paper);
        box-shadow: 0 16px 36px rgba(18, 45, 37, 0.06);
      }

      .card span {
        display: block;
        color: var(--muted);
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .card strong {
        display: block;
        margin-top: 10px;
        color: var(--brand);
        font-size: 28px;
        font-weight: 900;
        line-height: 1;
        letter-spacing: -0.045em;
      }

      .tableWrap {
        overflow: auto;
        border-radius: 26px;
        border: 1px solid var(--line);
        background: var(--paper);
        box-shadow: 0 18px 42px rgba(18, 45, 37, 0.07);
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 1120px;
      }

      th,
      td {
        padding: 15px 16px;
        border-bottom: 1px solid #edf2f5;
        text-align: left;
        vertical-align: top;
        font-size: 12.5px;
        line-height: 1.5;
      }

      th {
        position: sticky;
        top: 0;
        background: #f8fbfa;
        color: #49625a;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.075em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      td {
        color: #263a34;
        font-weight: 680;
      }

      tbody tr:nth-child(even) td {
        background: #fbfdfd;
      }

      tbody tr:last-child td {
        border-bottom: none;
      }

      .num {
        text-align: right;
        white-space: nowrap;
      }

      .empty {
        padding: 38px;
        text-align: center;
        color: var(--muted);
        font-weight: 800;
      }

      @page {
        size: A4 landscape;
        margin: 10mm;
      }

      @media print {
        body { padding: 0; background: #fff; }
        .toolbar button { display: none; }
        .shell { width: 100%; gap: 12px; }
        .cards { grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .card, .tableWrap { box-shadow: none; }
        .card { min-height: auto; padding: 11px 12px; border-radius: 14px; }
        .card strong { font-size: 18px; }
        h1 { font-size: 28px; }
        .subtitle { font-size: 10px; margin-top: 3px; }
        th { position: static; }
        th, td { padding: 6px 7px; font-size: 8px; line-height: 1.35; }
        th { font-size: 7px; }
        table { min-width: 0; }
      }

      @media (max-width: 860px) {
        body { padding: 16px; }
        .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <div class="toolbar">
        <div>
          <h1>${escapeHtml(options.title)}</h1>
          <p class="subtitle">${escapeHtml(options.subtitle)} Generated ${escapeHtml(options.generatedAt)}.</p>
        </div>
        <button type="button" onclick="window.print()">Print / Save PDF</button>
      </div>

      <section class="cards" aria-label="Fuel report summary">
        <div class="card"><span>Current storage</span><strong>${escapeHtml(formatLitres(options.currentLitres))}</strong></div>
        <div class="card"><span>Fuel issued</span><strong>${escapeHtml(formatLitres(options.totalIssued))}</strong></div>
        <div class="card"><span>Fuel filled</span><strong>${escapeHtml(formatLitres(options.totalStockIn))}</strong></div>
        <div class="card"><span>Storage units</span><strong>${options.storageCount.toLocaleString('en-ZA')}</strong></div>
      </section>

      <section class="tableWrap" aria-label="Fuel event ledger">
        ${options.events.length ? `<table>
          <thead>
            <tr>
              <th>Date</th><th>Type</th><th>Storage</th><th>Asset</th><th class="num">Litres</th><th class="num">Before</th><th class="num">After</th><th class="num">Asset fuel</th><th>Operator</th><th>Location</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>` : '<div class="empty">No fuel entries captured yet.</div>'}
      </section>
    </main>
  </body>
</html>`;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  }

  const storageId = asText(request.nextUrl.searchParams.get('storageId'));
  const year = parseReportYear(asText(request.nextUrl.searchParams.get('year')));
  const month = year ? parseReportMonth(asText(request.nextUrl.searchParams.get('month'))) : null;
  const dateRange = buildReportDateRange(year, month);

  try {
    const [ledger, events, storage] = await Promise.all([
      listFuelLedger(session.user.id),
      listFuelEventsForReport(session.user.id, {
        storageId: storageId || undefined,
        fromIso: dateRange.fromIso,
        toIso: dateRange.toIso,
      }),
      storageId ? getFuelStorageById(session.user.id, storageId) : Promise.resolve(null),
    ]);

    if (storageId && !storage) {
      return NextResponse.json({ ok: false, error: 'Fuel storage not found.' }, { status: 404 });
    }

    const totalIssued = events
      .filter((event) => event.eventType === 'asset_issue')
      .reduce((sum, event) => sum + event.litres, 0);
    const totalStockIn = events
      .filter((event) => event.eventType === 'stock_in' || event.eventType === 'opening_balance')
      .reduce((sum, event) => sum + event.litres, 0);
    const title = storage ? `${storage.name} Fuel Report` : 'Fuel Ledger Report';
    const subtitle = storage
      ? `Storage report for ${storage.fuelType.toUpperCase()} (${storage.publicFuelStorageCode}) · ${dateRange.label}.`
      : `All fuel storage and fuel issue transactions · ${dateRange.label}.`;
    const generatedAt = new Intl.DateTimeFormat('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Johannesburg',
    }).format(new Date());

    const html = buildReportHtml({
      title,
      subtitle,
      generatedAt,
      totalIssued,
      totalStockIn,
      currentLitres: storage ? storage.currentLitres : ledger.summary.currentLitres,
      storageCount: storage ? 1 : ledger.summary.totalStorageUnits,
      events,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-disposition': `inline; filename="${slugifyFileSegment(title)}.html"`,
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
