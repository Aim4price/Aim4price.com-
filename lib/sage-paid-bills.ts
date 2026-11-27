import { matchedAccountingAsset, categoryForLine } from './accounting-serial.ts';
import { costCategories } from './cost-categories.ts';

type Asset = { id: string; title: string; serialNumber: string };
const money = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

// A bill paid in instalments becomes eligible once the final payment clears.
export function paidBillCosts(bill: Record<string, unknown>, randIds: Set<number>, assets: Asset[], homeCurrency?: number) {
  if (bill.Paid !== true || bill.AmountDue !== 0) return [];
  if (!money(bill.Total) || bill.Total <= 0) return [];
  if (!Array.isArray(bill.Lines) || !bill.Lines.length) throw Error('Missing paid bill lines');
  const seen = new Set<string>();
  const costs = bill.Lines.filter(line => line.Total !== 0).map(line => {
    const currency = line.CurrencyId ?? bill.Supplier_CurrencyId ?? homeCurrency;
    if (!randIds.has(currency) || !money(line.Total) || line.Total <= 0 ||
      !money(line.Tax) || line.Tax < 0 || line.Tax > line.Total) throw Error('Unsupported paid bill amount');
    const key = String(line.ID ?? '');
    if (!key || seen.has(key) || !bill.ID || !bill.SupplierName) throw Error('Incomplete paid bill');
    seen.add(key);
    const description = String(line.Description || '');
    const category = costCategories.find(c => c.label === categoryForLine(description))?.value ?? 'other';
    return { key, assetId: matchedAccountingAsset(description,assets)?.id ?? null,
      details: { supplier: String(bill.SupplierName), invoice: String(bill.DocumentNumber || bill.ID),
        date: String(bill.Date).slice(0,10), total: line.Total, vat: line.Tax, description, category } };
  });
  const cents = costs.reduce((sum,line) => sum + Math.round(line.details.total * 100),0);
  if (cents !== Math.round(bill.Total * 100)) throw Error('Paid bill line totals do not reconcile');
  return costs;
}
