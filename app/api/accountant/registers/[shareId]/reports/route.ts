import { NextRequest, NextResponse } from 'next/server';
import { listFinanceAgreements, listRecurringCommitments } from '../../../../../../lib/accounting-collaboration';
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

function annualFinanceAmount(amount: number | null, frequency: string): number | null {
  if (amount === null) return null;
  const multiplier = frequency === 'monthly' ? 12 : frequency === 'quarterly' ? 4 : frequency === 'six_monthly' ? 2 : 1;
  return Math.round(amount * multiplier * 100) / 100;
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

    if (kind === 'finance-position' || kind === 'financed-paid-off') {
      const assetIds = new Set(assets.map((asset) => asset.id));
      const agreements = (await listFinanceAgreements(data.access.ownerUserId))
        .filter((agreement) => agreement.links.some((link) => assetIds.has(link.assetId)));
      const reportRows: CsvCell[][] = [];
      for (const agreement of agreements) {
        reportRows.push(['Agreement', agreement.agreementName, agreement.referenceNumber, agreement.financierName,
          agreement.agreementType, agreement.agreementStatus, agreement.agreementScope, agreement.originalAmount,
          agreement.outstandingBalance, agreement.latestBalanceDate, agreement.settlementAmount, agreement.settlementDate,
          agreement.instalment, agreement.instalmentFrequency, annualFinanceAmount(agreement.instalment, agreement.instalmentFrequency),
          agreement.balloon, agreement.balloonDate, agreement.interestRate, agreement.startDate, agreement.maturityDate,
          agreement.sourceReference, agreement.securityDescription, '', '', '', '']);
        for (const link of agreement.links.filter((item) => assetIds.has(item.assetId))) {
          reportRows.push(['Linked asset', agreement.agreementName, agreement.referenceNumber, agreement.financierName,
            '', agreement.agreementStatus, agreement.agreementScope, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
            link.assetTitle, link.linkRole, link.originalAmountAllocation, link.settlementAllocation]);
        }
      }
      return reportResponse(`${baseName}-finance-position-and-commitments`, [
        ['Row type', 'Finance Agreement', 'Reference', 'Financier', 'Agreement type', 'Status', 'Coverage scope',
          'Original amount', 'Outstanding balance', 'Balance date', 'Settlement amount', 'Settlement valid date',
          'Instalment', 'Frequency', 'Annual finance commitment', 'Balloon', 'Balloon date', 'Interest rate',
          'Start date', 'Maturity date', 'Source', 'Security / collateral', 'Linked asset', 'Link role',
          'Original allocation', 'Settlement allocation'],
        ...reportRows,
      ]);
    }

    if (kind === 'market-value-trend' || kind === 'depreciation') {
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
      return reportResponse(`${baseName}-market-value-trend`, [
        ['Market Value Trend is a record of saved Aim4price Market Value movement. It is not accounting or tax depreciation.'],
        [],
        ['Asset', 'Revaluation date', 'Opening Aim4price Market Value', 'Current Aim4price Market Value', 'Market Value movement', 'Replacement value', 'Usage', 'Condition', 'Event'],
        ...history.rows.map((row) => [row.asset_title, row.captured_at, row.previous_estimated_value_ex_vat, row.estimated_value_ex_vat,
          Number(row.estimated_value_ex_vat || 0) - Number(row.previous_estimated_value_ex_vat || row.estimated_value_ex_vat || 0),
          row.replacement_price_ex_vat, [row.usage_amount, row.usage_metric].filter(Boolean).join(' '), row.condition, row.event_type]),
      ]);
    }

    if (kind === 'cost-of-ownership' || kind === 'cost-ledger') {
      const ledger = await getAccountantLedger({ accountantUserId: session.user.id, shareId: context.params.shareId, kind: 'cost' });
      const requestedYear = Number(params.get('year'));
      const requestedMonth = Number(params.get('month'));
      const invoices = ledger.cost?.invoices.filter((invoice) => {
        if (requestedAssetId && invoice.assetId !== requestedAssetId) return false;
        if (Number.isInteger(requestedYear) && requestedYear >= 2000) {
          const invoiceDate = invoice.invoiceDate ? new Date(`${invoice.invoiceDate}T00:00:00`) : null;
          if (!invoiceDate || Number.isNaN(invoiceDate.getTime()) || invoiceDate.getFullYear() !== requestedYear) return false;
          if (Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 && invoiceDate.getMonth() + 1 !== requestedMonth) return false;
        }
        return true;
      }) ?? [];
      const incurredRows: CsvCell[][] = invoices.map((invoice) => ['Incurred cost', invoice.assetTitle, invoice.invoiceDate, invoice.supplierName, invoice.invoiceNumber,
          invoice.blocks.find((block) => block.blockType === 'maintenance')?.totalIncVat,
          invoice.blocks.find((block) => block.blockType === 'parts')?.totalIncVat,
          invoice.blocks.find((block) => block.blockType === 'repair')?.totalIncVat,
          invoice.blocks.find((block) => block.blockType === 'other')?.totalIncVat,
          invoice.vatAmount, invoice.totalIncVat, [invoice.usageReading, invoice.usageMetric].filter(Boolean).join(' '), '', '', '', '', '', '']);
      if (kind === 'cost-ledger') {
        return reportResponse(`${baseName}-cost-ledger`, [
          ['Entry type', 'Asset', 'Date', 'Supplier', 'Invoice', 'Maintenance', 'Parts', 'Repairs', 'Other', 'VAT', 'Total incl. VAT', 'Usage'],
          ...incurredRows.map((row) => row.slice(0, 12)),
        ]);
      }
      const commitments = await listRecurringCommitments(data.access.ownerUserId, new Set(assets.map((asset) => asset.id)));
      const commitmentRows: CsvCell[][] = commitments.map((commitment) => [
        'Future recurring commitment', commitment.assets.map((asset) => asset.assetTitle).join(' · '), commitment.startDate, '', commitment.sourceReference,
        '', '', '', commitment.amount, '', '', '', commitment.description, commitment.category,
        commitment.frequency, commitment.annualAmount, commitment.renewalDate || commitment.endDate, commitment.status,
      ]);
      return reportResponse(`${baseName}-cost-of-ownership`, [
        ['Entry type', 'Asset', 'Date', 'Supplier', 'Invoice / reference', 'Maintenance', 'Parts', 'Repairs', 'Other',
          'VAT', 'Total incl. VAT', 'Usage', 'Description', 'Category', 'Frequency', 'Annual commitment',
          'Renewal / end date', 'Status'],
        ...incurredRows,
        ...commitmentRows,
      ]);
    }

    if (kind === 'fuel-report' || kind === 'fuel-ledger' || kind === 'fuel') {
      const ledger = await getAccountantLedger({ accountantUserId: session.user.id, shareId: context.params.shareId, kind: 'fuel' });
      const events = ledger.fuel?.recentEvents.filter((event) => !requestedAssetId || event.assetId === requestedAssetId) ?? [];
      if (kind === 'fuel-report') {
        const byAsset = new Map<string, { litres: number; amount: number; entries: number }>();
        for (const event of events) {
          const key = event.assetTitle || 'Unallocated';
          const current = byAsset.get(key) ?? { litres: 0, amount: 0, entries: 0 };
          current.litres += Number(event.litres || 0);
          current.amount += Number(event.totalAmount || 0);
          current.entries += 1;
          byAsset.set(key, current);
        }
        return reportResponse(`${baseName}-fuel-report`, [
          ['Asset', 'Recorded entries', 'Total litres', 'Recorded amount'],
          ...[...byAsset.entries()].map(([assetTitle, totals]) => [assetTitle, totals.entries,
            Math.round(totals.litres * 100) / 100, Math.round(totals.amount * 100) / 100]),
        ]);
      }
      return reportResponse(`${baseName}-fuel`, [
        ['Asset', 'Date', 'Storage', 'Event', 'Litres', 'Amount', 'Usage', 'Operator', 'Location', 'Note', 'Supporting document'],
        ...events.map((event) => [event.assetTitle, event.createdAtIso, event.storageName, event.eventType,
          event.litres, event.totalAmount, event.assetUsageReading, event.operatorName, event.locationText,
          event.note, event.documentFileUrl]),
      ]);
    }

    if (kind === 'asset-register') {
      return reportResponse(`${baseName}-asset-register`, [
        ['Asset', 'Year model', 'Brand', 'Model', 'Serial number', 'Registration number', 'Condition', 'Status',
          'Aim4price Market Value', 'Replacement value', 'Accounting Book Value', 'Accounting as-at date', 'Financed',
          'Insured', 'Licensed', 'Last updated'],
        ...assets.map((asset) => [asset.title, asset.yearModel, asset.brandName, asset.modelName, asset.serialNumber,
          asset.licenseRegistrationNumber, asset.condition, 'Active', asset.value, asset.replacementPriceExVat,
          asset.accountingValue?.carryingValue, asset.accountingValue?.asAtDate, asset.isFinanced, asset.isInsured,
          asset.isLicensed, asset.updatedAtIso]),
      ]);
    }

    if (kind === 'audit-history') {
      return NextResponse.json({ ok: false, error: 'Asset Change History is an in-product audit record and is not downloadable.' }, { status: 404 });
    }

    const financeLinks = new Map<string, Array<{ name: string; role: string; allocation: number | null }>>();
    for (const agreement of await listFinanceAgreements(data.access.ownerUserId)) {
      for (const link of agreement.links) {
        if (!assets.some((asset) => asset.id === link.assetId)) continue;
        financeLinks.set(link.assetId, [...(financeLinks.get(link.assetId) ?? []), {
          name: agreement.agreementName,
          role: link.linkRole,
          allocation: link.settlementAllocation,
        }]);
      }
    }
    return reportResponse(`${baseName}-market-versus-accounting`, [
      ['Asset', 'Aim4price Market Value', 'Replacement value', 'Accounting Book Value', 'Accounting as-at date',
        'Original accounting cost', 'Accumulated depreciation', 'Allocated finance settlement', 'Finance Agreement / link role',
        'Accounting source system', 'Source document / reference', 'Last updated by'],
      ...assets.map((asset) => [asset.title, asset.value, asset.replacementPriceExVat, asset.accountingValue?.carryingValue,
        asset.accountingValue?.asAtDate, asset.accountingValue?.originalAccountingCost,
        asset.accountingValue?.accumulatedDepreciation,
        (financeLinks.get(asset.id) ?? []).some((link) => link.allocation !== null)
          ? (financeLinks.get(asset.id) ?? []).reduce((sum, link) => sum + Number(link.allocation || 0), 0) : null,
        (financeLinks.get(asset.id) ?? []).map((link) => `${link.name} (${link.role.replace(/_/g, ' ')})`).join(' · '),
        asset.accountingValue?.sourceAccountingSystem,
        asset.accountingValue?.sourceReference, asset.accountingValue?.updatedByOrganisation || asset.accountingValue?.updatedByName]),
    ]);
  } catch (error) {
    console.error('accountant report GET failed', error);
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
