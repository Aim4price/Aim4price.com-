import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [adminRoute, captureStore, finalizer, client] = await Promise.all([
  read("app/api/admin/capture-requests/[requestId]/route.ts"),
  read("lib/capture-requests.ts"),
  read("lib/capture-finalization.ts"),
  read("app/admin/capture-queue/capture-queue-client.tsx"),
]);

const usageFunctionStart = captureStore.indexOf("export async function updateCaptureRequestAssetUsage");
const usageFunctionEnd = captureStore.indexOf("export async function matchCaptureRequest", usageFunctionStart);
const usageFunction = captureStore.slice(usageFunctionStart, usageFunctionEnd);

test("confirm_match enforces the post-claim version under the request row lock", () => {
  const matchFunctionStart = captureStore.indexOf("export async function matchCaptureRequest");
  const matchFunctionEnd = captureStore.indexOf("async function assertFilesReady", matchFunctionStart);
  const matchFunction = captureStore.slice(matchFunctionStart, matchFunctionEnd);
  const saveDraftStart = adminRoute.indexOf("async function saveAdminDraft");
  const saveDraftEnd = adminRoute.indexOf("export async function GET", saveDraftStart);
  const saveDraft = adminRoute.slice(saveDraftStart, saveDraftEnd);

  assert.ok(matchFunctionStart >= 0 && matchFunctionEnd > matchFunctionStart);
  assert.match(captureStore, /export type CaptureRequestMatchInput = \{[\s\S]*?expectedVersion: number/);
  assert.match(matchFunction, /const expectedVersion = Number\(input\.expectedVersion\)/);
  assert.match(matchFunction, /const existing = await getLockedRequest\(client, id\)[\s\S]*?asNumber\(existing\.version\) !== expectedVersion[\s\S]*?CAPTURE_REQUEST_CHANGED/);
  assert.ok(
    matchFunction.indexOf("const existing = await getLockedRequest")
      < matchFunction.indexOf("asNumber(existing.version) !== expectedVersion"),
  );
  assert.match(saveDraft, /current = await claimWhenNeeded\(request, actor\)/);
  assert.match(saveDraft, /matchCaptureRequest\(current\.id, \{[\s\S]*?expectedVersion: current\.version/);
});

test("server usage parsing agrees with grouped Admin readings and rejects malformed values", () => {
  const parserStart = captureStore.indexOf("function captureUsageReading");
  const parserEnd = captureStore.indexOf("function capturePayloadBoolean", parserStart);
  const parser = captureStore.slice(parserStart, parserEnd);

  assert.ok(parserStart >= 0 && parserEnd > parserStart);
  assert.match(parser, /normalized\.includes\(','\) && normalized\.includes\('\.'\)/);
  assert.match(parser, /normalized\.lastIndexOf\(','\) > normalized\.lastIndexOf\('\.'\)/);
  assert.match(parser, /normalized\.replace\(\/\\\.\/g, ''\)\.replace\(',', '\.'\)/);
  assert.match(parser, /normalized\.replace\(\/,\/g, ''\)/);
  assert.match(parser, /\^\\d\{1,3\}\(,\\d\{3\}\)\+\$/);
  assert.match(parser, /if \(!\/\^\(\?:\\d\+[\s\S]*?return null/);
  assert.match(parser, /Number\.isFinite\(parsed\) && parsed >= 0/);

  const executableParser = parser.replace(
    "function captureUsageReading(value: unknown): number | null",
    "function captureUsageReading(value)",
  );
  const parseUsage = Function(`${executableParser}; return captureUsageReading;`)();
  assert.equal(parseUsage("1,234"), 1234);
  assert.equal(parseUsage("1,234.5"), 1234.5);
  assert.equal(parseUsage("1.234,5"), 1234.5);
  assert.equal(parseUsage("12 345,75"), 12345.75);
  assert.equal(parseUsage("1,23,4"), null);
  assert.equal(parseUsage("-1"), null);
  assert.equal(parseUsage("not a reading"), null);
});

test("Admin Capture exposes update_usage as a separate, exactly-confirmed action", () => {
  assert.match(adminRoute, /type AdminAction =[^;]*\| "update_usage"/s);
  assert.match(adminRoute, /const allowedActions: AdminAction\[\] = \[[\s\S]*?"update_usage"/);
  assert.match(adminRoute, /case "update_usage": \{/);
  assert.match(
    adminRoute,
    /\["complete", "complete_direct", "update_usage"\]\.includes\(action\)[\s\S]*?!draftTargetIsConfirmed\(existing, draft\)/,
  );
  assert.match(
    adminRoute,
    /action === "update_usage"[\s\S]*?!cleanText\(draft\.assetId, 80\)[\s\S]*?cleanText\(draft\.fuelStorageId, 80\)/,
  );
  assert.match(adminRoute, /event\.eventType === "matched"/);
  assert.match(adminRoute, /latestMatch\.metadata\.ownerUserId[\s\S]*?target\.ownerUserId/);
  assert.match(adminRoute, /latestMatch\.metadata\.assetId[\s\S]*?target\.assetId/);
  assert.match(adminRoute, /latestMatch\.metadata\.fuelStorageId[\s\S]*?target\.fuelStorageId/);
});

test("update_usage chains the post-draft version into the atomic usage write", () => {
  const caseStart = adminRoute.indexOf('case "update_usage":');
  const caseEnd = adminRoute.indexOf('case "save_draft":', caseStart);
  const updateCase = adminRoute.slice(caseStart, caseEnd);

  assert.ok(caseStart >= 0 && caseEnd > caseStart);
  assert.match(updateCase, /const saved = await saveAdminDraft\(existing, draft, actor\)/);
  assert.match(updateCase, /updateCaptureRequestAssetUsage\(requestId, \{[\s\S]*?expectedVersion: saved\.version/);
  assert.ok(
    updateCase.indexOf("await saveAdminDraft")
      < updateCase.indexOf("await updateCaptureRequestAssetUsage"),
  );
  assert.match(updateCase, /usage\.updated[\s\S]*?already at/);
});

test("the server locks the request and exact owner-scoped asset before changing usage", () => {
  assert.ok(usageFunctionStart >= 0 && usageFunctionEnd > usageFunctionStart);
  assert.match(usageFunction, /return withTransaction\(async \(client\) => \{/);
  assert.match(usageFunction, /assertCaptureRequestNotFinalizing\(client, id\)/);
  assert.match(usageFunction, /const existing = await getLockedRequest\(client, id\)/);
  assert.match(usageFunction, /asNumber\(existing\.version\) !== expectedVersion[\s\S]*?CAPTURE_REQUEST_CHANGED/);
  assert.match(usageFunction, /from public\.document_capture_events[\s\S]*?event_type = 'matched'[\s\S]*?order by created_at desc, id desc[\s\S]*?limit 1/);
  assert.match(usageFunction, /matchedOwnerUserId !== ownerUserId[\s\S]*?matchedAssetId !== assetId[\s\S]*?matchedFuelStorageId[\s\S]*?CAPTURE_TARGET_NOT_CONFIRMED/);
  assert.match(usageFunction, /from public\.asset_register_items asset[\s\S]*?where asset\.user_id = \$1[\s\S]*?asset\.id = \$2::uuid[\s\S]*?for update/);
  assert.deepEqual(
    [...usageFunction.matchAll(/\[ownerUserId, assetId\]/g)].map((match) => match[0]).length >= 1,
    true,
  );
});

test("invoice and fuel readings are selected server-side and N/A cannot mutate the asset", () => {
  assert.match(usageFunction, /if \(existing\.request_type === 'invoice'\)/);
  assert.match(usageFunction, /capturedMetric !== metric[\s\S]*?CAPTURE_USAGE_METRIC_MISMATCH/);
  assert.match(usageFunction, /newReading = captureUsageReading\(capturedPayload\.usageReading\)/);
  assert.match(usageFunction, /else if \(existing\.request_type === 'fuel_slip'\)/);
  assert.match(usageFunction, /capturePayloadBoolean\(capturedPayload\.usageNotApplicable\)[\s\S]*?CAPTURE_USAGE_NOT_APPLICABLE/);
  assert.match(
    usageFunction,
    /metric === 'km'[\s\S]*?capturedPayload\.odometerReading[\s\S]*?: capturedPayload\.hourMeterReading/,
  );
  assert.match(usageFunction, /newReading === null[\s\S]*?CAPTURE_USAGE_READING_REQUIRED/);
});

test("usage can advance or no-op, but can never be lowered", () => {
  const lowerGuard = usageFunction.indexOf("newReading < previousReading");
  const equalGuard = usageFunction.indexOf("newReading === previousReading");
  const updateStatement = usageFunction.indexOf("update public.asset_register_items");

  assert.ok(lowerGuard >= 0 && equalGuard > lowerGuard && updateStatement > equalGuard);
  assert.match(usageFunction, /previousReading !== null && newReading < previousReading[\s\S]*?CAPTURE_USAGE_CANNOT_DECREASE/);
  assert.match(
    usageFunction,
    /previousReading !== null && newReading === previousReading[\s\S]*?updated: false[\s\S]*?previousReading,[\s\S]*?newReading/,
  );
  assert.match(
    usageFunction,
    /set hours = greatest\(coalesce\(hours, \$3::numeric\), \$3::numeric\)/,
  );
  assert.match(
    usageFunction,
    /where user_id = \$1[\s\S]*?and id = \$2::uuid[\s\S]*?\[ownerUserId, assetId, newReading/,
  );
});

test("an actual advance is audited and invalidates only an existing saved valuation", () => {
  assert.match(usageFunction, /const hasSavedValuation = Boolean\(asset\.valuation_run_id\)/);
  assert.match(usageFunction, /hasSavedValuation[\s\S]*?markCaptureUsageValuationStale\(specs, new Date\(\)\.toISOString\(\)\)[\s\S]*?: specs/);
  assert.match(usageFunction, /specs_json = case when \$4::boolean then \$5::jsonb else specs_json end/);
  assert.match(usageFunction, /eventType: 'note_added'/);
  assert.match(usageFunction, /action: 'asset_usage_updated'/);
  assert.match(usageFunction, /ownerUserId,[\s\S]*?assetId,[\s\S]*?metric,[\s\S]*?previousReading,[\s\S]*?newReading/);
  assert.match(captureStore, /valuationNeedsUpdate: true/);
  assert.match(captureStore, /Asset usage updated from Admin Capture/);
});

test("ledger completion never implicitly updates fuel usage", () => {
  const outputStart = finalizer.indexOf("async function createFuelOutput");
  const outputEnd = finalizer.indexOf("async function validateCapturedDraft", outputStart);
  const fuelOutput = finalizer.slice(outputStart, outputEnd);

  assert.ok(outputStart >= 0 && outputEnd > outputStart);
  assert.match(fuelOutput, /saveFuelSlipTransaction\(request\.ownerUserId, \{/);
  assert.match(fuelOutput, /updateAssetUsage: false/);
  assert.match(client, /Completing the ledger record does not update usage\. Only this button does\./);
  assert.match(client, /onClick=\{\(\) => void runAction\("update_usage"\)\}/);
  assert.match(client, /usageUpdate\.metric === "hours" \? "Update hours" : "Update kilometres"/);
});

test("PATCH responses recover same-tab state without silently retrying a stale action", () => {
  assert.match(
    adminRoute,
    /const latestDetail = await buildResponseDetail\(requestId\)\.catch\(\(\) => null\)/,
  );
  assert.match(adminRoute, /ok: false,[\s\S]*?errorCode: code\.startsWith\("CAPTURE_"\)[\s\S]*?\.\.\.\(latestDetail \?\? \{\}\)/);
  assert.match(client, /const submittedVersion = detail\?\.version/);
  assert.match(
    client,
    /if \(!response\.ok \|\| !data\.ok\) \{[\s\S]*?data\.request && data\.request\.version !== submittedVersion[\s\S]*?applyDetailResponse\(data\)/,
  );
  assert.match(client, /data\.errorCode === "CAPTURE_REQUEST_CHANGED"[\s\S]*?setReconfirmationRequestId\(selectedId\)/);
  assert.match(client, /if \(!applyDetailResponse\(data\)\) \{[\s\S]*?await loadDetail\(selectedId\)/);
  assert.match(client, /setNotice\(\{ tone: "success"[\s\S]*?await loadQueue\(\)/);
  assert.doesNotMatch(client, /errorCode === "CAPTURE_REQUEST_CHANGED"[\s\S]{0,300}runAction\(/);
});
