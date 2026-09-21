export const BILLING_ISSUER = {
  name: 'Aim4price', address: '14 Saffraan Ave, Denneoord, George, 6529',
  email: 'Aim4price@gmail.com', bank: 'ABSA', accountNumber: '4113 0591 64', vat: 'No VAT applicable',
} as const;
export const BILLING_ACCOUNT_TYPES = ['owner', 'dealer', 'finance', 'insurance', 'licensing'] as const;
export type BillingPlan = { accountType: string; description: string; amountCents: number; interval: 'once' | 'monthly' | 'annual'; dueDays: number; version: number; enabled: boolean };
export type BillingLine = { description: string; quantity: number; unitCents: number; totalCents: number; workSessionId?: string };
export type BillingCustomer = { name: string; email: string; address: string };
export type BillingInvoice = { id: string; userId: string; number: string | null; status: 'draft' | 'issued' | 'void'; customer: BillingCustomer; lines: BillingLine[]; totalCents: number; paidCents: number; dueDate: string; issuedAt: string | null; createdAt: string; note: string; deliveryStatus: string | null; version: number; voidReason?: string };
export function money(cents: number): string { return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100); }
export function moneyToCents(value: unknown): number {
  const text = String(value ?? '').trim().replace(/ /g, '');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) throw new Error('Enter a valid amount with at most two decimal places.');
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function dateKey(now = new Date()): string { return new Date(now.getTime() + 7200000).toISOString().slice(0, 10); }
export function validDate(value: unknown): string {
  const date = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error('Choose a valid date.');
  return date;
}
export function nextBillingDate(start: string, interval: BillingPlan['interval']): string | null {
  if (interval === 'once') return null;
  const date = new Date(validDate(start) + 'T00:00:00Z');
  const year = date.getUTCFullYear() + (interval === 'annual' ? 1 : 0);
  const month = date.getUTCMonth() + (interval === 'monthly' ? 1 : 0);
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate()))).toISOString().slice(0,10);
}
export function cleanCustomer(value: unknown): BillingCustomer {
  const c = value as Partial<BillingCustomer> | null;
  const name = String(c?.name ?? '').trim(), email = String(c?.email ?? '').trim(), address = String(c?.address ?? '').trim();
  if (!name || name.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !address || address.length > 600) throw new Error('Provide a billing name, valid email and address.');
  return { name, email, address };
}
export function cleanLines(value: unknown): BillingLine[] {
  if (!Array.isArray(value) || !value.length || value.length > 40) throw new Error('Add between 1 and 40 invoice lines.');
  const lines = value.map(line => {
    const description = String(line?.description ?? '').trim();
    const quantity = Number(line?.quantity), unitCents = Number(line?.unitCents);
    if (!description || description.length > 400 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000 || !Number.isSafeInteger(unitCents) || unitCents < 0 || unitCents > 999999999) throw new Error('Check the description, quantity and price on each invoice line.');
    return { description, quantity, unitCents, totalCents: quantity * unitCents };
  });
  const total = lines.reduce((sum, line) => sum + line.totalCents, 0);
  if (!Number.isSafeInteger(total) || total <= 0 || total > 999999999) throw new Error('Invoice total must be above zero and below R10 million.');
  return lines;
}
export function invoiceState(invoice: BillingInvoice): string {
  if (invoice.status === 'draft') return 'Draft';
  if (invoice.status === 'void') return 'Void';
  if (invoice.paidCents >= invoice.totalCents) return 'Paid';
  if (invoice.dueDate < dateKey()) return 'Overdue';
  return invoice.paidCents > 0 ? 'Part paid' : 'Outstanding';
}
