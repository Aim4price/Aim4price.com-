import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const cost = read('app/my-invoices/my-invoices-client.tsx');
const fuel = read('app/fuel/fuel-client.tsx');

test('fuel-derived costs open the shared fuel editor instead of the manual cost draft', () => {
  assert.match(cost, /function editInvoice\(invoice: InvoiceRecord\) \{\s*if \(invoice.source === 'fuel_slip'\).*setFuelCostInvoiceId\(invoice.id\); return;/);
  assert.match(cost, /CostLedgerFuelEditor key=\{fuelCostInvoiceId\}/);
  assert.match(fuel, /item.assetInvoiceId === costLedgerEntry.invoiceId/);
  assert.match(fuel, /if \(slip\) openFuelSlipReview\(slip\)/);
  assert.match(fuel, /if \(costLedgerEntry\) \{ costLedgerEntry.onSaved\(\); return; \}/);
  assert.match(cost, /Promise.all\(\[reloadData\(\), reloadBudgets\(\)\]\)/);
});

test('invoice lookup stays owner scoped, workspace filtered, and applies before the recent-slip limit', () => {
  const route = read('app/api/fuel/route.ts');
  assert.match(route, /resolveOwnerWorkspaceContext\(request, \{ ledger: 'fuel' \}\)/);
  assert.match(route, /filterFuelLedgerForWorkspace\([\s\S]*?resolved.context,[\s\S]*?listFuelLedger\(resolved.context.ownerUserId, \{ assetInvoiceId:/);
  const ledger = read('lib/fuel-ledger.ts');
  const query = ledger.slice(ledger.indexOf('async function listFuelSlips('), ledger.indexOf('export async function listFuelSlipsForReport'));
  assert.match(query, /where fs.user_id = \$1 and fs.record_status = 'active'/);
  assert.match(query, /fs.asset_invoice_id::text = \$2[\s\S]*order by[\s\S]*limit/);
  assert.match(query, /\[userId, options.assetInvoiceId\]/);
});

 test('Manage keeps edit and delete choices for fuel costs', () => {
  const manager = cost.slice(cost.indexOf('function openInvoiceManager('), cost.indexOf('function closeFuelCostEditor('));
  assert.match(manager, /setManagedInvoice\(invoice\)/);
  assert.doesNotMatch(manager, /setFuelCostInvoiceId/);
  assert.match(cost, /setManagedInvoice\(null\); editInvoice\(managedInvoice\)/);
  assert.match(cost, /setManagedInvoice\(null\); openDeleteInvoiceDialog\(managedInvoice\)/);
});
