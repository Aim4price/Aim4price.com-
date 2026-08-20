import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin completion owns canonical creation and gates outside submissions on owner approval', async () => {
  const [finalizer, adminRoute] = await Promise.all([
    read('lib/capture-finalization.ts'),
    read('app/api/admin/capture-requests/[requestId]/route.ts'),
  ]);

  assert.match(finalizer, /export async function finalizeCaptureRequestForAdmin/);
  assert.match(finalizer, /EXTERNAL_CHANNELS\.has\(request\.submissionChannel\) && !ownerApproved/);
  assert.match(finalizer, /transitionCaptureRequest\(request\.id, 'awaiting_owner'/);
  assert.match(finalizer, /createInvoiceDocumentRecord/);
  assert.match(finalizer, /createMyInvoice/);
  assert.match(finalizer, /saveFuelSlipTransaction/);
  assert.match(finalizer, /completeCaptureRequest/);
  assert.match(adminRoute, /finalizeCaptureRequestForAdmin\(requestId, actor\)/);
  assert.doesNotMatch(adminRoute, /canonicalOutputId/);
});
test('canonical records retain unique capture provenance for retry-safe completion', async () => {
  const [migration, invoices, fuel, finalizer] = await Promise.all([
    read('database/migrations/83-assisted-document-capture.sql'),
    read('lib/my-invoices.ts'),
    read('lib/fuel-ledger.ts'),
    read('lib/capture-finalization.ts'),
  ]);

  assert.match(migration, /asset_invoices_capture_request_uidx/);
  assert.match(migration, /idx_fuel_slips_capture_request/);
  assert.match(migration, /foreign key \(capture_request_id\)[\s\S]*?document_capture_requests/);
  assert.match(invoices, /on conflict \(capture_request_id\) where capture_request_id is not null do nothing/);
  assert.match(fuel, /where user_id = \$1[\s\S]*?capture_request_id = \$2::uuid/);
  assert.match(finalizer, /pg_advisory_lock/);
  assert.match(finalizer, /existingCanonicalOutput/);
});

test('public quarantine bytes are integrity checked, privately promoted, and never exposed raw', async () => {
  const [finalizer, ownerFileRoute] = await Promise.all([
    read('lib/capture-finalization.ts'),
    read('app/api/capture-requests/[requestId]/files/[fileId]/route.ts'),
  ]);

  assert.match(finalizer, /readCaptureQuarantineFile/);
  assert.match(finalizer, /createHash\('sha256'\)/);
  assert.match(finalizer, /createAssetRegisterUpload/);
  assert.match(finalizer, /set promoted_upload_id = \$3/);
  assert.match(finalizer, /deleteCaptureQuarantineFile/);
  assert.match(finalizer, /documentFileUrl: `\/api\/capture-requests\/\$\{encodeURIComponent\(request\.id\)\}\/files/);
  assert.doesNotMatch(finalizer, /createCaptureQuarantineSignedGetUrl/);
  assert.match(ownerFileRoute, /capture\.ownerUserId !== ownerId/);
  assert.match(ownerFileRoute, /file\.securityStatus !== 'clean'/);
  assert.match(ownerFileRoute, /Cache-Control': 'private, no-store/);
  assert.match(ownerFileRoute, /Content-Security-Policy': "sandbox; default-src 'none'"/);
});

test('owner decision API is owner-scoped and approval creates the ledger record', async () => {
  const [decisionRoute, finalizer] = await Promise.all([
    read('app/api/capture-requests/[requestId]/decision/route.ts'),
    read('lib/capture-finalization.ts'),
  ]);

  assert.match(decisionRoute, /profile\.accountType !== 'owner'/);
  assert.match(decisionRoute, /request\.ownerUserId !== ownerUserId/);
  assert.match(decisionRoute, /decision !== 'approve' && decision !== 'decline'/);
  assert.match(decisionRoute, /approveCaptureRequestForOwner\(requestId, actor\)/);
  assert.match(decisionRoute, /declineCaptureRequestForOwner/);
  assert.doesNotMatch(decisionRoute, /storageKey|promotedUploadId|uploadUrl/);
  assert.match(finalizer, /event\.eventType === 'owner_approved'/);
  assert.match(finalizer, /completeCanonicalOutput\(request/);
});

test('admin-reviewed fuel values override the originally submitted hints', async () => {
  const finalizer = await read('lib/capture-finalization.ts');

  assert.match(finalizer, /capturedPayload\.usageMetric \?\? candidatePayload\.usageMetric/);
  assert.match(finalizer, /capturedPayload\.odometerReading \?\? candidatePayload\.odometerReading/);
  assert.match(finalizer, /capturedPayload\.hourMeterReading \?\? candidatePayload\.hourMeterReading/);
  assert.match(finalizer, /firstText\(capturedPayload, \['operatorName'\]/);
  assert.match(finalizer, /firstText\(capturedPayload, \['activityText', 'activity'\]/);
  assert.match(finalizer, /firstText\(capturedPayload, \['workAreaText'\]/);
  assert.match(finalizer, /capturedPayload\.assetFuelPercentBefore \?\? candidatePayload\.assetFuelPercentBefore/);
  assert.match(finalizer, /capturedPayload\.assetFuelPercentAfter \?\? candidatePayload\.assetFuelPercentAfter/);
});

test('approved dealer submissions keep dealer provenance on the document and ledger record', async () => {
  const [finalizer, invoices, dealerRoute] = await Promise.all([
    read('lib/capture-finalization.ts'),
    read('lib/my-invoices.ts'),
    read('app/api/dealer/capture-requests/invoice/route.ts'),
  ]);

  assert.match(dealerRoute, /dealerStaffId: context\.actor\.dealerStaffId/);
  assert.match(finalizer, /request\.submissionChannel === 'dealer_upload'/);
  assert.match(finalizer, /dealerUserId[\s\S]*?request\.submittedByUserId/);
  assert.match(finalizer, /dealerStaffId: text\(request\.candidatePayload\.dealerStaffId/);
  assert.match(finalizer, /ownerApproved: request\.events\.some\(\(event\) => event\.eventType === 'owner_approved'\)/);
  assert.match(finalizer, /createInvoiceDocumentRecord\([\s\S]*?actor: outputActor/);
  assert.match(finalizer, /createMyInvoice\([\s\S]*?\}, outputActor\)/);
  assert.match(invoices, /actor\.ownerApproved \? 'approved' : 'pending'/);
  assert.match(invoices, /case when \$6 = 'approved' then now\(\) else null end/);
});
