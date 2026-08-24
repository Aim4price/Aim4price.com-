import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('accountant capture writes require direct-update permission and listings honor each shared ledger', async () => {
  const [workspace, statusRoute, invoiceRoute, fuelRoute] = await Promise.all([
    read('lib/owner-workspace-access.ts'),
    read('app/api/capture-requests/route.ts'),
    read('app/api/capture-requests/invoice/route.ts'),
    read('app/api/capture-requests/fuel-slip/route.ts'),
  ]);

  assert.match(workspace, /requireWrite\?: boolean/);
  assert.match(workspace, /requireWrite: options\.requireWrite/);
  assert.match(invoiceRoute, /ledger: 'cost', requireWrite: true/);
  assert.match(fuelRoute, /ledger: 'fuel', requireWrite: true/);
  assert.match(statusRoute, /requestedType === 'invoice'[\s\S]*?'cost'[\s\S]*?requestedType === 'fuel_slip'[\s\S]*?'fuel'/);
  assert.match(statusRoute, /accountantAccess\.includeCostLedger/);
  assert.match(statusRoute, /accountantAccess\.includeFuelLedger/);
});

test('capture intake rejects non-owner direct accounts and gates owner-app mutations and assets', async () => {
  const [invoiceRoute, fuelRoute] = await Promise.all([
    read('app/api/capture-requests/invoice/route.ts'),
    read('app/api/capture-requests/fuel-slip/route.ts'),
  ]);

  for (const route of [invoiceRoute, fuelRoute]) {
    assert.match(route, /!context\.accountantAccess && !ownerAppAccess/);
    assert.match(route, /ownerAppAccess\?\.sessionKind === 'owner-app-user'/);
    assert.match(route, /ownerAppCan\(ownerAppAccess, 'manage_finance'\)/);
    assert.match(route, /ownerAppCanAccessAsset\(ownerAppAccess,/);
  }
  assert.match(fuelRoute, /targetType === 'asset'[\s\S]*?ownerAppAccess\.assetScope !== 'all'/);
});

test('owner-app capture status, review detail, decisions and files stay inside assigned assets', async () => {
  const [statusRoute, decisionRoute, fileRoute] = await Promise.all([
    read('app/api/capture-requests/route.ts'),
    read('app/api/capture-requests/[requestId]/decision/route.ts'),
    read('app/api/capture-requests/[requestId]/files/[fileId]/route.ts'),
  ]);

  assert.match(statusRoute, /!resolved\.context\.accountantAccess && !ownerAppAccess/);
  assert.match(statusRoute, /ownerAppAccess\?\.sessionKind === 'owner-app-user' && ownerAppAccess\.assetScope === 'selected'/);
  assert.match(statusRoute, /capture\.assetId && ownerAppCanAccessAsset\(ownerAppAccess, capture\.assetId\)/);
  assert.match(decisionRoute, /ownerAppCanReachCapture/);
  assert.match(decisionRoute, /access\.assetScope !== 'selected'/);
  assert.match(decisionRoute, /ownerAppCanAccessAsset\(access, request\.assetId\)/);
  assert.match(decisionRoute, /ownerAppCan\(actor\.ownerAppAccess, 'manage_finance'\)/);
  assert.match(fileRoute, /owner\.ownerAppAccess\.sessionKind === 'owner-app-user'/);
  assert.match(fileRoute, /owner\.ownerAppAccess\.assetScope === 'selected'/);
  assert.match(fileRoute, /!capture\.assetId \|\| !ownerAppCanAccessAsset\(owner\.ownerAppAccess, capture\.assetId\)/);
});

test('capture retraction is owner-only, finance-gated, channel-limited and asset-scoped', async () => {
  const [route, finalizer, statusRoute, statusView] = await Promise.all([
    read('app/api/capture-requests/[requestId]/route.ts'),
    read('lib/capture-finalization.ts'),
    read('app/api/capture-requests/route.ts'),
    read('lib/capture-request-view.ts'),
  ]);

  assert.match(route, /profile\.accountType !== 'owner' \|\| profile\.accountStatus !== 'active'/);
  assert.match(route, /ownerAppCan\(resolved\.access, 'manage_finance'\)/);
  assert.match(route, /capture\.ownerUserId !== access\.ownerUserId/);
  assert.match(route, /capture\.submissionChannel !== 'owner_upload'/);
  assert.match(route, /access\.sessionKind !== 'owner-app-user' \|\| access\.assetScope !== 'selected'/);
  assert.match(route, /capture\.assetId && ownerAppCanAccessAsset\(access, capture\.assetId\)/);
  assert.match(route, /retractCaptureRequestForOwner\(capture\.id, resolved\.actor\)/);
  assert.match(route, /This capture request was not found/);
  assert.doesNotMatch(route, /resolveOwnerWorkspaceContext/);

  const retraction = finalizer.slice(finalizer.indexOf('export async function retractCaptureRequestForOwner'));
  assert.match(retraction, /request\.ownerUserId !== ownerActor\.userId/);
  assert.match(retraction, /request\.submissionChannel !== 'owner_upload'/);
  assert.match(statusRoute, /ownerAppCan\(ownerAppAccess, 'manage_finance'\)/);
  assert.match(statusRoute, /capture\.submissionChannel === 'owner_upload'/);
  assert.match(statusView, /options\.canRetract && !isTerminal/);
});

test('Invoice Drop code mutations require finance permission and direct codes remain asset-scoped', async () => {
  const route = await read('app/api/invoice-drop-codes/[assetId]/route.ts');

  assert.match(route, /requireFinanceMutation\?: boolean/);
  assert.match(route, /ownerAppCan\(ownerAppAccess, 'manage_finance'\)/);
  assert.match(route, /ownerAppCanAccessAsset\(access\.ownerAppAccess, assetId\)/);
  assert.match(route, /if \(assetId === 'all'\)[\s\S]*?scope: 'all', assetId: null/);
  assert.match(route, /scope: 'asset', assetId/);
  assert.match(route, /requireOwnerAccess\(request, \{ requireFinanceMutation: true \}\)/);
  assert.equal(
    (route.match(/requireOwnerAccess\(request, \{ requireFinanceMutation: true \}\)/g) || []).length,
    2,
  );
});

test('failed authenticated intake removes unlinked uploads in both database and bucket-only modes', async () => {
  const [invoiceRoute, fuelRoute, dealerInvoiceRoute, uploads] = await Promise.all([
    read('app/api/capture-requests/invoice/route.ts'),
    read('app/api/capture-requests/fuel-slip/route.ts'),
    read('app/api/dealer/capture-requests/invoice/route.ts'),
    read('lib/asset-register-uploads.ts'),
  ]);

  for (const route of [invoiceRoute, fuelRoute, dealerInvoiceRoute]) {
    assert.match(route, /let unlinkedUploadUrl = ''/);
    assert.match(route, /let createdCaptureId = ''/);
    assert.match(route, /captureFileLinked = true/);
    assert.match(route, /transitionCaptureRequest\(createdCaptureId, 'rejected'/);
    assert.match(route, /unlinkedUploadUrl && !captureFileLinked/);
    assert.match(route, /deleteUnreferencedAssetRegisterUploads/);
  }
  assert.match(uploads, /bucketOnlyUploadIds/);
  assert.match(uploads, /delete from public\.asset_register_bucket_uploads upload/);
  assert.match(uploads, /await assertBucketOnlyCatalogReady\(\)/);
  assert.match(uploads, /queue_deleted_bucket_upload_trigger/);
  assert.match(uploads, /capture_file\.promoted_upload_id = upload\.id::text/);
});

