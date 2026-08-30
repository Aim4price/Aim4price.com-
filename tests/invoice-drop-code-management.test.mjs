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
const invoiceDropWizard = ledger.slice(
  ledger.indexOf('{invoiceDropCodeOpen && !invoiceDropAssetPickerOpen ? ('),
  ledger.indexOf('{sourceChoiceOpen ? ('),
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

test('code lifecycle uses the capture domain and full-code viewing is an explicit owner action', () => {
  const getHandler = api.slice(
    api.indexOf('export async function GET'),
    api.indexOf('export async function POST'),
  );
  const postHandler = api.slice(
    api.indexOf('export async function POST'),
    api.indexOf('export async function DELETE'),
  );

  assert.match(getHandler, /getActiveInvoiceDropCode/);
  assert.match(getHandler, /request\.nextUrl\.searchParams\.get\('reveal'\) === '1'/);
  assert.match(getHandler, /revealActiveInvoiceDropCode/);
  assert.match(getHandler, /requireOwnerAccess\(request, \{ requireFinanceMutation: reveal \}\)/);
  assert.match(getHandler, /created before secure viewing was enabled/);
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
  assert.match(ledger, /Invoice uploads only\. No asset access\./);
  assert.match(ledger, /<strong>All assets<\/strong>/);
  assert.match(ledger, /<strong>One asset<\/strong>/);
  assert.match(ledger, /selectInvoiceDropScope\('all'\)/);
  assert.match(ledger, /selectInvoiceDropScope\('asset'\)/);
  assert.match(ledger, /invoiceDropWizardStep === 2[\s\S]*?Choose an asset/);
  assert.match(ledger, /invoiceDropWizardStep === 3[\s\S]*?Create your code/);
  assert.match(ledger, /invoiceDropWizardStep !== 3/);
  assert.match(ledger, /setInvoiceDropCodeLoading\(true\);[\s\S]*?setInvoiceDropWizardStep\(3\)/);
  assert.match(ledger, /Your assets stay private\./);
  assert.match(ledger, /no asset list is shown/i);
  assert.match(ledger, /disabled=\{invoiceDropWizardStep === 1 \? !invoiceDropScope : invoiceDropScope === 'asset' && !invoiceDropAssetId\}/);
  assert.match(ledger, /const invoiceDropTargetKey = invoiceDropScope === 'all'[\s\S]*?\? 'all'[\s\S]*?: invoiceDropScope === 'asset'[\s\S]*?\? invoiceDropAssetId[\s\S]*?: ''/);
  assert.match(ledger, /\/api\/invoice-drop-codes\/\$\{encodeURIComponent\(invoiceDropTargetKey\)\}/);
});

test('Invoice Drop code wizard stays focused and responsive', () => {
  assert.match(ledgerStyles, /\.downloadModal\.invoiceDropCodeModal \{[\s\S]*?width: min\(100%, 1120px\) !important/);
  assert.match(ledgerStyles, /\.invoiceDropWizardProgress \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(ledgerStyles, /\.invoiceDropScopeGrid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(ledgerStyles, /@media \(max-width: 720px\)[\s\S]*?\.invoiceDropScopeGrid \{[\s\S]*?grid-template-columns: 1fr/);
  assert.match(ledgerStyles, /\.invoiceDropCodeHeader \.closeButton,[\s\S]*?border-radius: 999px/);
  assert.match(ledgerStyles, /\.invoiceDropCodeCreateState \.primaryButton \{[\s\S]*?grid-column: 2/);
});

test('one-asset routing uses a searchable app-styled picker instead of a native select', () => {
  assert.match(invoiceDropWizard, /invoiceDropAssetPickerOpen/);
  assert.match(invoiceDropWizard, /invoiceDropAsset\?\.title \?\? 'Choose an asset'/);
  assert.match(invoiceDropWizard, /placeholder="Search assets\.\.\."/);
  assert.match(invoiceDropWizard, /filteredInvoiceDropAssets\.map/);
  assert.match(invoiceDropWizard, /chooseInvoiceDropAsset\(asset\.id\)/);
  assert.match(ledger, /const invoiceDropAssetDetails = useMemo/);
  assert.match(ledger, /formatAssetUsageReading\(invoiceDropAsset\.usageReading, invoiceDropAsset\.usageMetric\)/);
  assert.match(invoiceDropWizard, /invoiceDropAssetDetails \|\| \[invoiceDropAsset\.categoryLabel, invoiceDropAsset\.yearModel\]/);
  assert.doesNotMatch(invoiceDropWizard, /Choose one saved asset/);
  assert.doesNotMatch(invoiceDropWizard, /<select/);
  assert.match(ledgerStyles, /\.invoiceDropAssetPickerModal \{[\s\S]*?width: min\(100%, 880px\)/);
});

test('code stage makes secure creation and deliberate replacement explicit', () => {
  assert.match(invoiceDropWizard, /Create your code/);
  assert.match(invoiceDropWizard, /Create code/);
  assert.match(invoiceDropWizard, /Change code/);
  assert.match(invoiceDropWizard, /Active code/);
  assert.doesNotMatch(invoiceDropWizard, /Generate a secure code/);
  assert.doesNotMatch(invoiceDropWizard, /You do not need to type one/);
  assert.doesNotMatch(invoiceDropWizard, /Keep using it until you choose to change or revoke it/);
  assert.match(ledger, /Change this code\? The current code will stop working immediately\./);
});

test('current code can be explicitly viewed, hidden and copied without storing plaintext in the UI by default', () => {
  assert.match(ledger, /setNewInvoiceDropCode\(issued\.code\)/);
  assert.match(ledger, /const \[revealedInvoiceDropCode, setRevealedInvoiceDropCode\] = useState\(''\)/);
  assert.match(ledger, /\?reveal=1/);
  assert.match(invoiceDropWizard, /View code/);
  assert.match(invoiceDropWizard, /Hide code/);
  assert.match(invoiceDropWizard, /visibleInvoiceDropCode/);
  assert.match(ledger, /setNewInvoiceDropCode\(''\)/);
  assert.match(ledger, /A4P-••••-••••-\{invoiceDropCode\.lastFour\}/);
  assert.match(ledger, /Visible here only\./);
  assert.match(ledger, /href="\/drop-invoice"/);
  assert.match(ledger, /Copy link/);
  assert.match(ledger, /Share/);
});

test('Invoice Drop wizard avoids repeated headings and helper copy', () => {
  assert.doesNotMatch(invoiceDropWizard, /Choose where invoices should go\./);
  assert.doesNotMatch(invoiceDropWizard, /Complete one short step at a time/);
  assert.doesNotMatch(invoiceDropWizard, /Choose one option\./);
  assert.doesNotMatch(invoiceDropWizard, /Confirm the invoice route/);
  assert.doesNotMatch(invoiceDropWizard, /Choose the asset/);
  assert.doesNotMatch(invoiceDropWizard, /Create and share the code/);
  assert.doesNotMatch(invoiceDropWizard, /<span>Contribution code<\/span>/);
});
