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

test('Invoice Drop code API is owner-only and asset-scoped', () => {
  assert.match(api, /resolveOwnerWorkspaceContext\(request, \{ ledger: 'cost' \}\)/);
  assert.match(api, /context\.accountantAccess \|\| context\.ownerUserId !== context\.actorUserId/);
  assert.match(api, /profile\.accountType !== 'owner'/);
  assert.match(api, /isOwnerAppSession\(session\)/);
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

test('Cost Ledger exposes code management only in the direct owner workspace', () => {
  assert.match(ledger, /const canManageInvoiceDropCodes = !dealerMode && !accountantShareId && !accountantRegisterId/);
  assert.match(ledger, /\{canManageInvoiceDropCodes \? \(/);
  assert.match(ledger, /<span>Contribution<\/span>/);
  assert.match(ledger, /Contribution-only access/);
  assert.match(ledger, /cannot open your account, identify the asset, or reveal any asset details/i);
  assert.match(ledger, /\/api\/invoice-drop-codes\/\$\{encodeURIComponent\(invoiceDropAssetId\)\}/);
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
