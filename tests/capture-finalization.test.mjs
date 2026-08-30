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
  assert.match(finalizer, /EXTERNAL_CHANNELS\.has\(request\.submissionChannel\)[\s\S]*?&& !ownerApproved[\s\S]*?&& !ownerApprovalOverrideReason/);
  assert.match(finalizer, /transitionCaptureRequest\(request\.id, 'awaiting_owner'/);
  assert.match(finalizer, /createInvoiceDocumentRecord/);
  assert.match(finalizer, /createMyInvoice/);
  assert.match(finalizer, /saveFuelSlipTransaction/);
  assert.match(finalizer, /completeCaptureRequest/);
  assert.match(adminRoute, /finalizeCaptureRequestForAdmin\(requestId, actor, \{/);
  assert.doesNotMatch(adminRoute, /canonicalOutputId/);
});

test('audited direct completion records an explicit owner-approval override', async () => {
  const [finalizer, captureStore, adminRoute] = await Promise.all([
    read('lib/capture-finalization.ts'),
    read('lib/capture-requests.ts'),
    read('app/api/admin/capture-requests/[requestId]/route.ts'),
  ]);
  const finalizationStart = finalizer.indexOf('export async function finalizeCaptureRequestForAdmin');
  const finalizationEnd = finalizer.indexOf('export async function approveCaptureRequestForOwner', finalizationStart);
  const finalization = finalizer.slice(finalizationStart, finalizationEnd);
  const completionStart = captureStore.indexOf('export async function completeCaptureRequest');
  const completionEnd = captureStore.indexOf('function readInvoiceDropCodeSecret', completionStart);
  const completion = captureStore.slice(completionStart, completionEnd);

  assert.ok(finalizationStart >= 0 && finalizationEnd > finalizationStart);
  assert.ok(completionStart >= 0 && completionEnd > completionStart);
  assert.match(adminRoute, /"complete_direct"/);
  assert.match(adminRoute, /\["request_information", "mark_duplicate", "reject", "complete_direct", "delete"\]\.includes\(action\) && !note/);
  assert.match(adminRoute, /action === "complete_direct"[\s\S]*?existing\.submissionChannel !== "dealer_upload"[\s\S]*?existing\.submissionChannel !== "public_drop"/);
  assert.match(adminRoute, /finalizeCaptureRequestForAdmin\(requestId, actor, \{[\s\S]*?ownerApprovalOverrideReason: note/);
  assert.match(finalization, /const ownerApprovalOverrideReason = text\(options\.ownerApprovalOverrideReason, 1_000\)/);
  assert.match(finalization, /request\.status === 'awaiting_owner' && !ownerApprovalOverrideReason/);
  assert.match(finalization, /request\.status === 'awaiting_owner' && ownerApprovalOverrideReason/);
  assert.match(finalization, /&& !ownerApprovalOverrideReason[\s\S]*?transitionCaptureRequest\(request\.id, 'awaiting_owner'/);
  assert.match(finalization, /completeCanonicalOutput\(request, actor, \{ ownerApprovalOverrideReason \}\)/);
  assert.match(completion, /const overrideReason = cleanMultilineText\(input\.ownerApprovalOverrideReason, 1_000\)/);
  assert.match(completion, /status === 'awaiting_owner' && Boolean\(overrideReason\)/);
  assert.match(completion, /and status = \$4/);
  assert.match(completion, /await assertOwnerApproval\(client, existing, overrideReason\)/);
  assert.match(completion, /eventType: 'output_linked'[\s\S]*?note: overrideReason[\s\S]*?ownerApprovalOverridden: Boolean\(overrideReason\)/);
});

test('finalization rechecks the confirmed target and request version under its lock', async () => {
  const [finalizer, captureStore, adminRoute] = await Promise.all([
    read('lib/capture-finalization.ts'),
    read('lib/capture-requests.ts'),
    read('app/api/admin/capture-requests/[requestId]/route.ts'),
  ]);

  assert.match(captureStore, /expectedVersion\?: number \| null/);
  assert.match(captureStore, /asNumber\(existing\.version\) !== expectedVersion[\s\S]*?CAPTURE_REQUEST_CHANGED/);
  assert.match(captureStore, /pg_try_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);
  assert.match(captureStore, /CAPTURE_FINALIZATION_IN_PROGRESS/);
  assert.match(captureStore, /matchCaptureRequest[\s\S]*?assertCaptureRequestNotFinalizing\(client, id\)/);
  assert.match(captureStore, /updateCaptureRequestDraft[\s\S]*?assertCaptureRequestNotFinalizing\(client, id\)/);
  assert.match(captureStore, /setCaptureRequestFileSecurityStatus[\s\S]*?assertCaptureRequestNotFinalizing\(client, requestUuid\)/);
  assert.match(captureStore, /addCaptureRequestFile[\s\S]*?assertCaptureRequestNotFinalizing\(client, id\)/);
  assert.match(captureStore, /if \(!options\.allowDuringFinalization\)[\s\S]*?assertCaptureRequestNotFinalizing\(client, id\)/);
  assert.match(adminRoute, /expectedVersion: current\.version/);
  assert.match(adminRoute, /const requestVersion = Math\.trunc\(Number\(body\.requestVersion\)\)/);
  assert.match(adminRoute, /existing\.version !== requestVersion[\s\S]*?CAPTURE_REQUEST_CHANGED/);
  assert.match(adminRoute, /expectedVersion: saved\.version/);
  assert.match(adminRoute, /expectedTarget: \{[\s\S]*?ownerUserId: target\.ownerUserId,[\s\S]*?assetId: target\.assetId \|\| null,[\s\S]*?fuelStorageId: target\.fuelStorageId \|\| null/);
  assert.match(finalizer, /withFinalizationLock\(requestId,[\s\S]*?request\.version !== options\.expectedVersion[\s\S]*?CAPTURE_REQUEST_CHANGED/);
  assert.match(finalizer, /assertExpectedCaptureTarget\(request, options\.expectedTarget\)/);
  assert.match(finalizer, /allowDuringFinalization: true/);
  assert.match(finalizer, /latestMatch\.metadata\.ownerUserId[\s\S]*?latestMatch\.metadata\.assetId[\s\S]*?latestMatch\.metadata\.fuelStorageId/);
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

test('owner retraction shares the finalization lock and refuses an existing canonical output', async () => {
  const finalizer = await read('lib/capture-finalization.ts');
  const start = finalizer.indexOf('export async function retractCaptureRequestForOwner');
  const retraction = finalizer.slice(start);

  assert.ok(start >= 0);
  assert.match(retraction, /withFinalizationLock\(requestId/);
  assert.match(retraction, /getCaptureRequestDetail\(requestId\)/);
  assert.match(retraction, /existingCanonicalOutput\(request\)/);
  assert.match(retraction, /CAPTURE_RETRACTION_OUTPUT_EXISTS/);
  assert.match(retraction, /removeOrphanedCaptureInvoiceDocument\(request\)/);
  assert.match(retraction, /transitionCaptureRequest\(request\.id, 'cancelled'/);
  assert.ok(
    retraction.indexOf('existingCanonicalOutput(request)')
      < retraction.indexOf("transitionCaptureRequest(request.id, 'cancelled'"),
  );
  assert.ok(
    retraction.indexOf('removeOrphanedCaptureInvoiceDocument(request)')
      < retraction.indexOf("transitionCaptureRequest(request.id, 'cancelled'"),
  );
});

test('admin cancellation shares the finalization lock and protects closed or materialized requests', async () => {
  const finalizer = await read('lib/capture-finalization.ts');
  const start = finalizer.indexOf('export async function cancelCaptureRequestForAdmin');
  const end = finalizer.indexOf('export async function retractCaptureRequestForOwner', start);
  const cancellation = finalizer.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(cancellation, /withFinalizationLock\(requestId/);
  assert.match(cancellation, /getCaptureRequestDetail\(requestId\)/);
  assert.match(cancellation, /if \(request\.status === 'cancelled'\) return request/);
  assert.match(cancellation, /\['completed', 'declined', 'rejected'\]\.includes\(request\.status\)/);
  assert.match(cancellation, /CAPTURE_REQUEST_CLOSED/);
  assert.match(cancellation, /request\.assignedAdminUserId[\s\S]*?request\.assignedAdminUserId !== actor\.userId[\s\S]*?CAPTURE_CLAIMED_BY_ANOTHER_ADMIN/);
  assert.match(cancellation, /const reason = text\(reasonInput, 1_000\)/);
  assert.match(cancellation, /CAPTURE_CANCELLATION_REASON_REQUIRED/);
  assert.match(cancellation, /existingCanonicalOutput\(request\)/);
  assert.match(cancellation, /CAPTURE_CANCELLATION_OUTPUT_EXISTS/);
  assert.match(cancellation, /removeOrphanedCaptureInvoiceDocument\(request\)/);
  assert.match(cancellation, /transitionCaptureRequest\(request\.id, 'cancelled'/);
  assert.match(cancellation, /reason: `Deleted from the Capture Queue: \$\{reason\}`/);
  assert.ok(
    cancellation.indexOf('existingCanonicalOutput(request)')
      < cancellation.indexOf('removeOrphanedCaptureInvoiceDocument(request)'),
  );
  assert.ok(
    cancellation.indexOf('removeOrphanedCaptureInvoiceDocument(request)')
      < cancellation.indexOf("transitionCaptureRequest(request.id, 'cancelled'"),
  );
});

test('partial invoice finalization cannot leave a downloadable orphan after retraction', async () => {
  const finalizer = await read('lib/capture-finalization.ts');
  const cleanupStart = finalizer.indexOf('async function removeOrphanedCaptureInvoiceDocument');
  const cleanupEnd = finalizer.indexOf('async function createInvoiceOutput', cleanupStart);
  const cleanup = finalizer.slice(cleanupStart, cleanupEnd);

  assert.ok(cleanupStart >= 0 && cleanupEnd > cleanupStart);
  assert.match(cleanup, /delete from public\.asset_invoice_documents document/);
  assert.match(cleanup, /document\.capture_request_id = \$1::uuid/);
  assert.match(cleanup, /document\.source = 'automatic'/);
  assert.match(cleanup, /invoice\.invoice_document_id = document\.id/);
  assert.match(cleanup, /invoice\.capture_request_id = \$1::uuid/);
  assert.match(cleanup, /slip\.invoice_document_id = document\.id/);
  assert.match(cleanup, /CAPTURE_RETRACTION_DOCUMENT_EXISTS/);
  assert.match(finalizer, /catch \(error\) \{[\s\S]*?removeOrphanedCaptureInvoiceDocument\(request\)[\s\S]*?throw error/);
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
  assert.match(finalizer, /operatorName: operatorNotApplicable[\s\S]*?capturedTextOrCandidateFallback\([\s\S]*?\['operatorName'\]/);
  assert.match(finalizer, /activityText: activityNotApplicable[\s\S]*?capturedTextOrCandidateFallback\([\s\S]*?\['activityText', 'activity'\]/);
  assert.match(finalizer, /workAreaText: workAreaNotApplicable[\s\S]*?capturedTextOrCandidateFallback\([\s\S]*?\['workAreaText'\]/);
  assert.match(finalizer, /capturedPayload\.assetFuelPercentBefore \?\? candidatePayload\.assetFuelPercentBefore/);
  assert.match(finalizer, /capturedPayload\.assetFuelPercentAfter \?\? candidatePayload\.assetFuelPercentAfter/);
});

test('fuel capture N/A choices suppress hints and satisfy only their matching operational fields', async () => {
  const finalizer = await read('lib/capture-finalization.ts');
  const normalizeStart = finalizer.indexOf('export function normalizeFuelCapturePayload');
  const normalizeEnd = finalizer.indexOf('function assertRequestId', normalizeStart);
  const normalizeFuel = finalizer.slice(normalizeStart, normalizeEnd);
  const operationalStart = finalizer.indexOf('async function assertFuelOperationalFields');
  const operationalEnd = finalizer.indexOf('async function createFuelOutput', operationalStart);
  const operationalValidation = finalizer.slice(operationalStart, operationalEnd);
  const outputStart = operationalEnd;
  const outputEnd = finalizer.indexOf('async function validateCapturedDraft', outputStart);
  const fuelOutput = finalizer.slice(outputStart, outputEnd);

  assert.ok(normalizeStart >= 0 && normalizeEnd > normalizeStart);
  assert.ok(operationalStart >= 0 && operationalEnd > operationalStart);
  assert.ok(outputStart >= 0 && outputEnd > outputStart);

  for (const field of [
    'usageNotApplicable',
    'operatorNotApplicable',
    'activityNotApplicable',
    'workAreaNotApplicable',
  ]) {
    assert.match(normalizeFuel, new RegExp(`const ${field} = capturedPayload\\.${field} === true`));
    assert.match(fuelOutput, new RegExp(`${field}: captured\\.${field}`));
  }

  assert.match(normalizeFuel, /let odometerReading = usageNotApplicable[\s\S]*?\? null[\s\S]*?capturedPayload\.odometerReading \?\? candidatePayload\.odometerReading/);
  assert.match(normalizeFuel, /let hourMeterReading = usageNotApplicable[\s\S]*?\? null[\s\S]*?capturedPayload\.hourMeterReading \?\? candidatePayload\.hourMeterReading/);
  assert.match(normalizeFuel, /operatorName: operatorNotApplicable[\s\S]*?\? ''[\s\S]*?: capturedTextOrCandidateFallback\([\s\S]*?\['operatorName'\]/);
  assert.match(normalizeFuel, /activityText: activityNotApplicable[\s\S]*?\? ''[\s\S]*?: capturedTextOrCandidateFallback\([\s\S]*?\['activityText', 'activity'\]/);
  assert.match(normalizeFuel, /workAreaText: workAreaNotApplicable[\s\S]*?\? ''[\s\S]*?: capturedTextOrCandidateFallback\([\s\S]*?\['workAreaText'\]/);

  assert.match(operationalValidation, /!captured\.operatorName && !captured\.operatorNotApplicable/);
  assert.match(operationalValidation, /!captured\.activityText && !captured\.activityNotApplicable/);
  assert.match(operationalValidation, /!captured\.workAreaText && !captured\.workAreaNotApplicable/);
  assert.match(operationalValidation, /if \(captured\.usageNotApplicable\) return/);
  assert.ok(
    operationalValidation.indexOf('if (captured.usageNotApplicable) return')
      < operationalValidation.indexOf("asset.usageMetric === 'km'"),
  );
  assert.match(fuelOutput, /saveFuelSlipTransaction\(request\.ownerUserId, \{[\s\S]*?updateAssetUsage: false/);
});

test('explicitly blank reviewed fuel fields do not resurrect candidate hints', async () => {
  const finalizer = await read('lib/capture-finalization.ts');
  const helperStart = finalizer.indexOf('function capturedTextOrCandidateFallback');
  const helperEnd = finalizer.indexOf('function decimal', helperStart);
  const fallbackHelper = finalizer.slice(helperStart, helperEnd);
  const normalizeStart = finalizer.indexOf('export function normalizeFuelCapturePayload');
  const normalizeEnd = finalizer.indexOf('function assertRequestId', normalizeStart);
  const normalizeFuel = finalizer.slice(normalizeStart, normalizeEnd);

  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  assert.ok(normalizeStart >= 0 && normalizeEnd > normalizeStart);
  assert.match(fallbackHelper, /capturedKeys\.some\(\(key\) => \([\s\S]*?Object\.prototype\.hasOwnProperty\.call\(capturedPayload, key\)/);
  assert.match(fallbackHelper, /return capturedFieldWasProvided[\s\S]*?\? firstText\(capturedPayload, capturedKeys, maxLength\)[\s\S]*?: firstText\(candidatePayload, candidateKeys, maxLength\)/);
  assert.match(normalizeFuel, /operatorName:[\s\S]*?capturedTextOrCandidateFallback\([\s\S]*?\['operatorName'\],[\s\S]*?\['operatorName'\]/);
  assert.match(normalizeFuel, /activityText:[\s\S]*?capturedTextOrCandidateFallback\([\s\S]*?\['activityText', 'activity'\],[\s\S]*?\['activityText'\]/);
  assert.match(normalizeFuel, /workAreaText:[\s\S]*?capturedTextOrCandidateFallback\([\s\S]*?\['workAreaText'\],[\s\S]*?\['workAreaText'\]/);
  assert.doesNotMatch(normalizeFuel, /firstText\(capturedPayload, \['(?:operatorName|activityText|workAreaText)'[\s\S]*?\|\| firstText\(candidatePayload/);
});

test('fuel operational validation finishes before external owner review begins', async () => {
  const finalizer = await read('lib/capture-finalization.ts');
  const validationStart = finalizer.indexOf('async function validateCapturedDraft');
  const validationEnd = finalizer.indexOf('function assertExpectedCaptureTarget', validationStart);
  const draftValidation = finalizer.slice(validationStart, validationEnd);
  const adminStart = finalizer.indexOf('export async function finalizeCaptureRequestForAdmin');
  const adminEnd = finalizer.indexOf('export async function approveCaptureRequestForOwner', adminStart);
  const adminCompletion = finalizer.slice(adminStart, adminEnd);
  const ownerStart = adminEnd;
  const ownerEnd = finalizer.indexOf('export async function declineCaptureRequestForOwner', ownerStart);
  const ownerCompletion = finalizer.slice(ownerStart, ownerEnd);

  assert.ok(validationStart >= 0 && validationEnd > validationStart);
  assert.ok(adminStart >= 0 && adminEnd > adminStart);
  assert.ok(ownerStart >= 0 && ownerEnd > ownerStart);
  assert.match(draftValidation, /const captured = normalizeFuelCapturePayload/);
  assert.match(draftValidation, /await assertFuelOperationalFields\(request, captured\)/);
  assert.match(adminCompletion, /await validateCapturedDraft\(request\)/);
  assert.ok(
    adminCompletion.indexOf('await validateCapturedDraft(request)')
      < adminCompletion.indexOf("transitionCaptureRequest(request.id, 'awaiting_owner'"),
  );
  assert.match(ownerCompletion, /await validateCapturedDraft\(request\)[\s\S]*?completeCanonicalOutput\(request/);
});

test('owner fuel review prefers captured values and renders explicit N/A without persisting it', async () => {
  const decisionRoute = await read('app/api/capture-requests/[requestId]/decision/route.ts');
  const helperStart = decisionRoute.indexOf('function reviewValue');
  const helperEnd = decisionRoute.indexOf('async function getOwnerActor', helperStart);
  const helper = decisionRoute.slice(helperStart, helperEnd);
  const reviewStart = decisionRoute.indexOf('function reviewFields');
  const reviewEnd = decisionRoute.indexOf('function responseDetail', reviewStart);
  const review = decisionRoute.slice(reviewStart, reviewEnd);

  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  assert.ok(reviewStart >= 0 && reviewEnd > reviewStart);
  assert.match(helper, /captured\[notApplicableKey\] === true/);
  assert.match(helper, /return 'N\/A'/);
  assert.match(helper, /payloadText\(captured, \.\.\.capturedKeys\) \|\| payloadText\(candidate, \.\.\.candidateKeys\)/);
  assert.match(review, /usageReading: reviewValue\([\s\S]*?'usageNotApplicable'/);
  assert.match(review, /operatorName: reviewValue\([\s\S]*?'operatorNotApplicable'[\s\S]*?\['operatorName'\]/);
  assert.match(review, /activityText: reviewValue\([\s\S]*?'activityNotApplicable'[\s\S]*?\['activityText', 'activity'\]/);
  assert.match(review, /workAreaText: reviewValue\([\s\S]*?'workAreaNotApplicable'[\s\S]*?\['workAreaText'\]/);
  assert.doesNotMatch(decisionRoute, /capturedPayload\.[A-Za-z]+\s*=\s*'N\/A'/);
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
  assert.match(finalizer, /ownerApproved: ownerApprovalOverridden[\s\S]*?event\.eventType === 'owner_approved'/);
  assert.match(finalizer, /createInvoiceDocumentRecord\([\s\S]*?actor: outputActor/);
  assert.match(finalizer, /createMyInvoice\([\s\S]*?\}, outputActor\)/);
  assert.match(invoices, /actor\.ownerApproved \? 'approved' : 'pending'/);
  assert.match(invoices, /case when \$6 = 'approved' then now\(\) else null end/);
});
