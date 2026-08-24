import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const api = readFileSync(
  new URL('../app/api/invoice-drop-codes/[assetId]/route.ts', import.meta.url),
  'utf8',
);
const ledger = readFileSync(
  new URL('../app/my-invoices/my-invoices-client.tsx', import.meta.url),
  'utf8',
);
const ledgerStyles = readFileSync(
  new URL('../app/my-invoices/page.module.css', import.meta.url),
  'utf8',
);

test('Invoice Drop code API is owner-only and supports owner-wide or one-asset targets', () => {
  assert.match(api, /resolveOwnerWorkspaceContext\(request, \{ ledger: 'cost' \}\)/);
  assert.match(api, /context\.accountantAccess \|\| context\.ownerUserId !== context\.actorUserId/);
  assert.match(api, /profile\.accountType !== 'owner'/);
  assert.match(api, /isOwnerAppSession\(session\)/);
  assert.match(api, /if \(assetId === 'all'\)/);
  assert.match(api, /scope: 'all', assetId: null/);
  assert.match(api, /assertWorkspaceAssetAccess\(access\.context, assetId\)/);
  assert.match(api, /getAssetRegisterItemById\(access\.context\.ownerUserId, assetId\)/);
});

test('code lifecycle uses the capture domain and GET never issues plaintext', () => {
  const getHandler = api.slice(
    api.indexOf('export async function GET'),
    api.indexOf('export async function POST'),
  );
  const postHandler = api.slice(
    api.indexOf('export async function POST'),
    api.indexOf('export async function DELETE'),
  );

  assert.match(getHandler, /getActiveInvoiceDropCode/);
  assert.doesNotMatch(getHandler, /issueInvoiceDropCode/);
  assert.match(postHandler, /issueInvoiceDropCode/);
  assert.match(api, /revokeInvoiceDropCode\(active\.id, owner\.access\.actor\)/);
  assert.match(api, /Cache-Control': 'private, no-store, max-age=0'/);
});

test('Cost Ledger exposes a gated three-step code wizard only in the direct owner workspace', () => {
  assert.match(ledger, /const canManageInvoiceDropCodes = !dealerMode && !accountantShareId && !accountantRegisterId/);
  assert.match(ledger, /\{canManageInvoiceDropCodes \? \(/);
  assert.match(ledger, /<span>Contribution<\/span>/);
  assert.match(ledger, /type InvoiceDropWizardStep = 1 \| 2 \| 3/);
  assert.match(ledger, /useState<InvoiceDropWizardStep>\(1\)/);
  assert.match(ledger, /\[\['Access', 1\], \['Routing', 2\], \['Code', 3\]\]/);
  assert.match(ledger, /invoiceDropWizardStep === 1[\s\S]*?Where should invoices go\?/);
  assert.match(ledger, /Contribution-only access/);
  assert.match(ledger, /<strong>All assets<\/strong>/);
  assert.match(ledger, /<strong>One asset<\/strong>/);
  assert.match(ledger, /selectInvoiceDropScope\('all'\)/);
  assert.match(ledger, /selectInvoiceDropScope\('asset'\)/);
  assert.match(ledger, /invoiceDropWizardStep === 2[\s\S]*?Choose the asset/);
  assert.match(ledger, /invoiceDropWizardStep === 3[\s\S]*?Contribution code/);
  assert.match(ledger, /invoiceDropWizardStep !== 3/);
  assert.match(ledger, /setInvoiceDropCodeLoading\(true\);[\s\S]*?setInvoiceDropWizardStep\(3\)/);
  assert.match(ledger, /never opens or lists your assets/i);
  assert.match(ledger, /no asset list is shown/i);
  assert.match(ledger, /disabled=\{invoiceDropWizardStep === 1 \? !invoiceDropScope : invoiceDropScope === 'asset' && !invoiceDropAssetId\}/);
  assert.match(ledger, /const invoiceDropTargetKey = invoiceDropScope === 'all'[\s\S]*?\? 'all'[\s\S]*?: invoiceDropScope === 'asset'[\s\S]*?\? invoiceDropAssetId[\s\S]*?: ''/);
  assert.match(ledger, /\/api\/invoice-drop-codes\/\$\{encodeURIComponent\(invoiceDropTargetKey\)\}/);
});

test('Invoice Drop code wizard stays compact and responsive', () => {
  assert.match(ledgerStyles, /\.invoiceDropCodeModal \{[\s\S]*?width: min\(100%, 720px\)/);
  assert.match(ledgerStyles, /\.invoiceDropWizardProgress \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(ledgerStyles, /\.invoiceDropScopeGrid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(ledgerStyles, /@media \(max-width: 720px\)[\s\S]*?\.invoiceDropScopeGrid \{[\s\S]*?grid-template-columns: 1fr/);
});

test('full code is an issuance-only UI state and later views show last four', () => {
  assert.match(ledger, /setNewInvoiceDropCode\(issued\.code\)/);
  assert.match(ledger, /setNewInvoiceDropCode\(''\)/);
  assert.match(ledger, /A4P-••••-••••-\{invoiceDropCode\.lastFour\}/);
  assert.match(ledger, /will not show the full code again/i);
  assert.match(ledger, /href="\/drop-invoice"/);
  assert.match(ledger, /Copy link/);
  assert.match(ledger, /Share/);
});
