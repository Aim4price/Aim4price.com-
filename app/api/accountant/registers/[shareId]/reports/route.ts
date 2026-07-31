import { NextRequest, NextResponse } from 'next/server';
import { accountantWorkspaceError, getAccountantLedger, getAccountantRegisterData } from '../../../../../../lib/accountant-workspace';
import { listAssetLifecycleReport } from '../../../../../../lib/asset-lifecycle';
import { getServerSession } from '../../../../../../lib/auth-session';
import { getDb } from '../../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string } };
type CsvCell = string | number | boolean | null | undefined;

function csvCell(value: CsvCell): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(rows: CsvCell[][]): string {
  return `\ufeff${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function reportResponse(name: string, rows: CsvCell[][]) {
  return new NextResponse(csv(rows), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

function specText(specs: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = String(specs[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function specNumber(specs: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    if (specs[key] === null || typeof specs[key] === 'undefined' || String(specs[key]).trim() === '') continue;
    const value = Number(specs[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export async function GET(request: NextRequest, context: Context) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const kind = params.get('kind') || 'market-accounting';
  const requestedAssetId = params.get('assetId') || '';

  try {
    const data = await getAccountantRegisterData(session.user.id, context.params.shareId);
    const assets = requestedAssetId ? data.items.filter((item) => item.id === requestedAssetId) : data.items;
    const baseName = data.register.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'asset-register';

    if (kind === 'additions-disposals') {
      const events = await listAssetLifecycleReport(data.access.ownerUserId, data.access.registerId, params.get('from'), params.get('to'));
      return reportResponse(`${baseName}-additions-disposals`, [
        ['Asset', 'Event', 'Reason', 'Effective date', 'Amount excl. VAT', 'Note', 'Supporting reference', 'Recorded by'],
        ...events.map((event) => [event.assetTitle, event.eventType, event.reason, event.effectiveDate, event.amountExVat, event.note, event.sourceDocumentReference, event.actorOrganisation || event.actorName]),
      ]);
    }

    if (kind === 'financed-paid-off') {
      const financeRow = (asset: (typeof assets)[number], rowType: string): CsvCell[] => {
        const specs = asset.specsJson;
        const status = specText(specs, 'financeStatus', 'finance_status') || (asset.isFinanced ? 'financed' : 'unknown');
        return [rowType, asset.title, status, specText(specs, 'financierName', 'financier_name'), specText(specs, 'financeType', 'finance_type'),
          specText(specs, 'financeReferenceNumber', 'finance_reference_number'), specNumber(specs, 'financeOriginalAmountExVat', 'finance_original_amount_ex_vat'),
          specNumber(specs, 'financeCurrentOutstandingExVat', 'finance_current_outstanding_ex_vat'), specNumber(specs, 'financeSettlementAmountExVat', 'finance_settlement_amount_ex_vat'),
          specNumber(specs, 'financeMonthlyPaymentExVat', 'finance_monthly_payment_ex_vat'), specNumber(specs, 'financeBalloonPaymentExVat', 'finance_balloon_payment_ex_vat'),
          specText(specs, 'financeStartDate', 'finance_start_date'), specText(specs, 'financeEndDate', 'finance_end_date'),
          specText(specs, 'financeLatestBalanceDate', 'finance_latest_balance_date'), specText(specs, 'financeSourceReference', 'finance_source_reference'),
          specText(specs, 'financeSecurityDescription', 'finance_security_description')];
      };
      const bulkGroups = new Map<string, typeof assets>();
      const individualAssets: typeof assets = [];
      for (const asset of assets) {
        const financeType = specText(asset.specsJson, 'financeType', 'finance_type');
        if (['bulk_group', 'bulk', 'group', 'group_finance'].includes(financeType)) {
          const key = [specText(asset.specsJson, 'financierName', 'financier_name'), specText(asset.specsJson, 'financeReferenceNumber', 'finance_reference_number')].join('|') || asset.id;
          bulkGroups.set(key, [...(bulkGroups.get(key) ?? []), asset]);
        } else {
          individualAssets.push(asset);
        }
      }
      const reportRows: CsvCell[][] = individualAssets.map((asset) => financeRow(asset, 'Asset'));
      for (const groupedAssets of bulkGroups.values()) {
        const representative = groupedAssets[0];
        reportRows.push(financeRow({ ...representative, title: `Facility — ${specText(representative.specsJson, 'financeReferenceNumber', 'finance_reference_number') || 'No reference'}` }, 'Bulk / group facility'));
        groupedAssets.forEach((asset) => reportRows.push(['Linked asset', asset.title, financeRow(asset, 'Linked asset')[2], '', '', '', '', '', '', '', '', '', '', '', '', '']));
      }
      return reportResponse(`${baseName}-financed-versus-paid-off`, [
        ['Row type', 'Asset / facility', 'Status', 'Financier', 'Finance type', 'Agreement / facility', 'Original amount', 'Outstanding balance', 'Settlement amount', 'Instalment', 'Balloon', 'Start date', 'Expected end date', 'Latest balance date', 'Source', 'Recorded collateral / security'],
        ...reportRows,
      ]);
    }

    if (kind === 'depreciation') {
      const ids = assets.map((asset) => asset.id);
      const history = ids.length ? await getDb().query<{
        asset_register_item_id: string; asset_title: string; captured_at: string;
        estimated_value_ex_vat: string | number; previous_estimated_value_ex_vat: string | number | null;
        replacement_price_ex_vat: string | number | null; usage_amount: string | number | null;
        usage_metric: string | null; condition: string | null; event_type: string;
      }>(
        `select asset_register_item_id::text, asset_title, captured_at::text, estimated_value_ex_vat,
                previous_estimated_value_ex_vat, replacement_price_ex_vat, usage_amount, usage_metric,
                condition, event_type
         from public.asset_depreciation_snapshots
         where user_id = $1 and register_id = $2::uuid and asset_register_item_id = any($3::uuid[])
         order by captured_at desc`,
        [data.access.ownerUserId, data.access.registerId, ids],
      ) : { rows: [] };
      return reportResponse(`${baseName}-aim4price-depreciation`, [
        ['Asset', 'Revaluation date', 'Opening Aim4price value', 'Current Aim4price value', 'Value movement', 'Replacement price', 'Usage', 'Condition', 'Event'],
        ...history.rows.map((row) => [row.asset_title, row.captured_at, row.previous_estimated_value_ex_vat, row.estimated_value_ex_vat,
          Number(row.estimated_value_ex_vat || 0) - Number(row.previous_estimated_value_ex_vat || row.estimated_value_ex_vat || 0),
          row.replacement_price_ex_vat, [row.usage_amount, row.usage_metric].filter(Boolean).join(' '), row.condition, row.event_type]),
      ]);
    }

    if (kind === 'cost-of-ownership') {
      const ledger = await getAccountantLedger({ accountantUserId: session.user.id, shareId: context.params.shareId, kind: 'cost' });
      const invoices = ledger.cost?.invoices.filter((invoice) => !requestedAssetId || invoice.assetId === requestedAssetId) ?? [];
      return reportResponse(`${baseName}-cost-of-ownership`, [
        ['Asset', 'Date', 'Supplier', 'Invoice', 'Maintenance', 'Parts', 'Repairs', 'Other', 'VAT', 'Total incl. VAT', 'Usage'],
        ...invoices.map((invoice) => [invoice.assetTitle, invoice.invoiceDate, invoice.supplierName, invoice.invoiceNumber,
          invoice.blocks.find((block) => block.blockType === 'maintenance')?.totalIncVat,
          invoice.blocks.find((block) => block.blockType === 'parts')?.totalIncVat,
          invoice.blocks.find((block) => block.blockType === 'repair')?.totalIncVat,
          invoice.blocks.find((block) => block.blockType === 'other')?.totalIncVat,
          invoice.vatAmount, invoice.totalIncVat, [invoice.usageReading, invoice.usageMetric].filter(Boolean).join(' ')]),
      ]);
    }

    if (kind === 'fuel') {
      const ledger = await getAccountantLedger({ accountantUserId: session.user.id, shareId: context.params.shareId, kind: 'fuel' });
      const events = ledger.fuel?.recentEvents.filter((event) => !requestedAssetId || event.assetId === requestedAssetId) ?? [];
      return reportResponse(`${baseName}-fuel`, [
        ['Asset', 'Date', 'Storage', 'Event', 'Litres', 'Amount', 'Usage', 'Operator', 'Location', 'Note', 'Supporting document'],
        ...events.map((event) => [event.assetTitle, event.createdAtIso, event.storageName, event.eventType,
          event.litres, event.totalAmount, event.assetUsageReading, event.operatorName, event.locationText,
          event.note, event.documentFileUrl]),
      ]);
    }

    if (kind === 'audit-history') {
      const ids = assets.map((asset) => asset.id);
      const events = ids.length ? await getDb().query<{
        event_type: string; entity_id: string; actor_user_id: string; metadata_json: unknown; created_at: string;
      }>(
        `select event_type, entity_id, actor_user_id, metadata_json, created_at::text
         from public.access_audit_events
         where owner_user_id = $1 and entity_id = any($2::text[])
         order by created_at desc`,
        [data.access.ownerUserId, ids],
      ) : { rows: [] };
      const titleById = new Map(assets.map((asset) => [asset.id, asset.title]));
      return reportResponse(`${baseName}-asset-change-history`, [
        ['Asset', 'Event', 'Actor', 'Date and time', 'Change details'],
        ...events.rows.map((event) => [titleById.get(event.entity_id) || event.entity_id, event.event_type, event.actor_user_id, event.created_at, JSON.stringify(event.metadata_json ?? {})]),
      ]);
    }

    return reportResponse(`${baseName}-market-versus-accounting`, [
      ['Asset', 'Aim4price market estimate', 'Replacement value', 'Accounting carrying value', 'Accounting as-at date', 'Outstanding finance balance', 'Accounting source', 'Last updated by'],
      ...assets.map((asset) => [asset.title, asset.value, asset.replacementPriceExVat, asset.accountingValue?.carryingValue,
        asset.accountingValue?.asAtDate, specNumber(asset.specsJson, 'financeCurrentOutstandingExVat', 'finance_current_outstanding_ex_vat'),
        asset.accountingValue?.sourceReference, asset.accountingValue?.updatedByOrganisation || asset.accountingValue?.updatedByName]),
    ]);
  } catch (error) {
    console.error('accountant report GET failed', error);
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
