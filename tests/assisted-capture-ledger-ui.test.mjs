import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [
  costClient,
  fuelClient,
  statusList,
  invoiceStore,
  sharedUploadRoute,
  privateDownloadRoute,
  ownerDecisionModal,
  ownerDecisionRoute,
  ownerCaptureFileRoute,
  adminCaptureFileRoute,
  ownerRetractionRoute,
  retiredInvoiceReader,
  retiredFuelReader,
] = await Promise.all([
  readFile(new URL('../app/my-invoices/my-invoices-client.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/fuel/fuel-client.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/CaptureRequestStatusList.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../lib/my-invoices.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/asset-register/uploads/[uploadId]/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/my-invoices/documents/[documentId]/download/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../components/CaptureRequestDecisionModal.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/capture-requests/[requestId]/decision/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/capture-requests/[requestId]/files/[fileId]/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/admin/capture-requests/[requestId]/files/[fileId]/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/capture-requests/[requestId]/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/my-invoices/extract/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/fuel/slips/extract/route.ts', import.meta.url), 'utf8'),
]);

test('Cost Ledger sends uploaded invoices for verified capture without calling the reader', () => {
  const assistedHandler = costClient.slice(
    costClient.indexOf('async function handleAutomaticExtract'),
    costClient.indexOf('async function submitInvoiceDraft'),
  );

  assert.match(assistedHandler, /captureApiRoot/);
  assert.match(assistedHandler, /Send for capture|sent for Aim4price capture/);
  assert.doesNotMatch(assistedHandler, /\/extract/);
  assert.match(retiredInvoiceReader, /status: 410/);
  assert.doesNotMatch(retiredInvoiceReader, /extractInvoiceFromUpload/);
  assert.match(costClient, /Aim4price will capture and verify it within 24 hours/);
  assert.match(costClient, /<CaptureRequestStatusList[\s\S]{0,120}requests=\{captureRequests\}/);
  assert.match(costClient, /captureRequestId/);
  assert.match(costClient, /CaptureRequestDecisionModal/);
});

test('Fuel assisted capture only needs the selected target and uploaded slip at intake', () => {
  const assistedHandler = fuelClient.slice(
    fuelClient.indexOf('async function handleFuelSlipExtract'),
    fuelClient.indexOf('function preventFuelSlipImplicitSubmit'),
  );

  assert.match(assistedHandler, /formData\.append\('file', fuelSlipUploadFile\)/);
  assert.match(assistedHandler, /formData\.append\('targetType', targetType\)/);
  assert.match(assistedHandler, /formData\.append\('targetId', targetId\)/);
  assert.doesNotMatch(assistedHandler, /customerFields|operatorName|activityText|workAreaText|submittedPayload/);
  assert.match(assistedHandler, /\/api\/capture-requests\/fuel-slip/);
  assert.doesNotMatch(assistedHandler, /\/api\/fuel\/slips\/extract/);
  assert.match(retiredFuelReader, /status: 410/);
  assert.doesNotMatch(retiredFuelReader, /extractFuelSlipFromUpload/);
  assert.match(fuelClient, /Upload the slip only — no extra details are needed/);
  assert.doesNotMatch(fuelClient, /accept="[^"]*text\/plain/);
});

test('pending captures are shown separately from financial ledger records', () => {
  assert.match(statusList, /Being captured/);
  assert.match(statusList, /Expected by/);
  assert.match(statusList, /Ready for approval/);
  assert.match(statusList, /Already saved/);
  assert.match(statusList, /Could not process/);
});

test('owners can retract unfinished assisted captures from both ledgers with a clear confirmation', () => {
  assert.match(statusList, /request\.canRetract && onRetract/);
  assert.match(statusList, /Retract this submission\?/);
  assert.match(statusList, /won&apos;t be added to your ledger/);
  assert.match(statusList, /Keep submission/);
  assert.match(statusList, /Retracting…/);
  assert.match(statusList, /role="dialog"/);
  assert.match(statusList, /role="alert"/);

  for (const client of [costClient, fuelClient]) {
    const handler = client.slice(
      client.indexOf('async function retractCaptureRequest'),
      client.indexOf('async function retractCaptureRequest') + 1_500,
    );
    assert.match(handler, /method: 'DELETE'/);
    assert.match(handler, /credentials: 'include'/);
    assert.match(handler, /current\.filter\(\(request\) => request\.id !== requestId\)/);
    assert.match(client, /onRetract=/);
  }
  assert.match(costClient, /canRetractCaptureRequests = !dealerMode && !accountantShareId && !accountantRegisterId/);
  assert.match(fuelClient, /onRetract=\{!accountantShareId && !accountantRegisterId/);
  assert.match(ownerRetractionRoute, /status: 'cancelled'/);
});

test('invoice bytes use an authorised no-store download instead of public upload URLs', () => {
  assert.match(invoiceStore, /buildMyInvoiceDocumentDownloadUrl/);
  assert.match(invoiceStore, /getInvoiceDocumentUploadForActor/);
  assert.match(sharedUploadRoute, /isProtectedInvoiceUpload\(uploadId\)/);
  assert.match(sharedUploadRoute, /isProtectedCaptureUpload\(uploadId\)/);
  assert.match(sharedUploadRoute, /status: 404/);
  assert.match(privateDownloadRoute, /resolveOwnerWorkspaceContext/);
  assert.match(privateDownloadRoute, /getDealerCostRequestContext/);
  assert.match(privateDownloadRoute, /Cache-Control': 'private, no-store'/);
  assert.match(privateDownloadRoute, /X-Content-Type-Options': 'nosniff'/);
});

test('owners review externally contributed documents before a ledger record is created', () => {
  assert.match(statusList, /request\.status === 'awaiting_owner'/);
  assert.match(statusList, />\s*Review\s*</);
  assert.match(ownerDecisionModal, /decision: 'approve' \| 'decline'/);
  assert.match(ownerDecisionModal, /Approve & add to/);
  assert.match(ownerDecisionModal, /Nothing is saved until you approve/);
  assert.match(ownerDecisionRoute, /request\.ownerUserId !== ownerUserId/);
  assert.match(ownerDecisionRoute, /approveCaptureRequestForOwner/);
  assert.match(ownerDecisionRoute, /declineCaptureRequestForOwner/);
  assert.match(ownerCaptureFileRoute, /capture\.ownerUserId !== ownerId/);
  assert.doesNotMatch(ownerCaptureFileRoute, /capture\.submissionChannel/);
  assert.match(ownerCaptureFileRoute, /file\.securityStatus !== 'clean'/);
  assert.match(ownerCaptureFileRoute, /Content-Security-Policy': "sandbox; default-src 'none'"/);
});

test('retracted source files are immediately hidden while asynchronous cleanup runs', () => {
  for (const route of [ownerCaptureFileRoute, adminCaptureFileRoute]) {
    assert.match(route, /HIDDEN_TERMINAL_STATUSES/);
    assert.match(route, /cancelled/);
    assert.match(route, /declined/);
    assert.match(route, /rejected/);
    assert.match(route, /HIDDEN_TERMINAL_STATUSES\.has\(capture\.status\)/);
  }
});
