import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  page,
  client,
  styles,
  access,
  collectionRoute,
  itemRoute,
  fileRoute,
  targetRoute,
  targetStore,
  usersPage,
  dashboardPage,
  lifecyclePage,
  assistancePage,
  captureStore,
] = await Promise.all([
  read("app/admin/capture-queue/page.tsx"),
  read("app/admin/capture-queue/capture-queue-client.tsx"),
  read("app/admin/capture-queue/page.module.css"),
  read("lib/admin-api-access.ts"),
  read("app/api/admin/capture-requests/route.ts"),
  read("app/api/admin/capture-requests/[requestId]/route.ts"),
  read("app/api/admin/capture-requests/[requestId]/files/[fileId]/route.ts"),
  read("app/api/admin/capture-requests/targets/route.ts"),
  read("lib/admin-capture-targets.ts"),
  read("app/admin/admin-client.tsx"),
  read("app/admin/dashboard/page.tsx"),
  read("app/admin/lifecycle-calculator/page.tsx"),
  read("app/admin/assistance-network/page.tsx"),
  read("lib/capture-requests.ts"),
]);

test("Capture Queue page and every API route require Aim4price admin access", () => {
  assert.match(page, /requireAdminPageAccess\(\)/);
  assert.match(access, /getAnyServerSession\(\)/);
  assert.match(access, /isAim4priceAdminEmail\(session\.user\.email\)/);
  assert.match(access, /Not authenticated\./);
  assert.match(access, /Admin access required\./);
  assert.match(collectionRoute, /requireAdminApiAccess\(\)/);
  assert.match(itemRoute, /requireAdminApiAccess\(\)/);
  assert.match(fileRoute, /requireAdminApiAccess\(\)/);
  assert.match(targetRoute, /requireAdminApiAccess\(\)/);
});

test("all current admin navigation surfaces expose Capture Queue", () => {
  for (const source of [page, usersPage, dashboardPage, lifecyclePage, assistancePage]) {
    assert.match(source, /href="\/admin\/capture-queue"/);
    assert.match(source, />\s*Capture Queue\s*</);
  }
});

test("queue prioritises deadline work and includes useful operational filters", () => {
  assert.match(client, /sortOverdueFirst/);
  assert.match(client, /Overdue/);
  assert.match(client, /Due today/);
  assert.match(client, /Needs information/);
  assert.match(client, /Awaiting owner/);
  assert.match(client, /Completed today/);
  assert.match(client, /Reference, sender, customer or asset/);
  assert.match(client, /Public Invoice Drop/);
  assert.match(styles, /\.kpiGrid/);
  assert.match(styles, /\.queueTableWrap/);
});

test("the 24-hour admin SLA pauses once a verified document is waiting on its owner", () => {
  assert.match(collectionRoute, /const SLA_STATUSES = OPEN_STATUSES\.filter\(\(status\) => status !== "awaiting_owner"\)/);
  assert.match(collectionRoute, /statusValue === "overdue"[\s\S]*?filters\.statuses = \[\.\.\.SLA_STATUSES\]/);
  assert.match(collectionRoute, /statusValue === "due_today"[\s\S]*?filters\.statuses = \[\.\.\.SLA_STATUSES\]/);
  assert.match(captureStore, /status not in \('awaiting_owner', 'completed', 'declined', 'rejected', 'cancelled'\)/);
  assert.match(client, /row\.status === "awaiting_owner" \? "Owner review"/);
});

test("selected work uses a split private document and verified capture workbench", () => {
  assert.match(client, /Capture workbench/);
  assert.match(client, /Private admin preview/);
  assert.match(client, /Verified details/);
  assert.match(client, /Customer and record destination/);
  assert.match(client, /Internal admin note/);
  assert.match(client, /Audit history/);
  assert.match(client, /\/api\/admin\/capture-requests\/\$\{encodeURIComponent\(requestId\)\}/);
  assert.match(styles, /grid-template-columns: minmax\(25rem, 0\.95fr\) minmax\(32rem, 1\.05fr\)/);
  assert.match(styles, /@media \(max-width: 980px\)/);
});

test("admin draft exposes every invoice and fuel field needed by canonical finalization", () => {
  for (const invoiceField of [
    "subtotalExVat",
    "totalIncVat",
    "usageMetric",
    "usageReading",
    "maintenanceWorkDone",
    "partsSupplied",
    "repairWorkDone",
    "notes",
  ]) {
    assert.match(client, new RegExp(`updateDraft\\(\\"${invoiceField}\\"`));
  }

  for (const fuelField of [
    "slipNumber",
    "pricePerLitre",
    "operatorName",
    "activityText",
    "workAreaText",
    "odometerReading",
    "hourMeterReading",
    "assetFuelPercentBefore",
    "assetFuelPercentAfter",
    "note",
  ]) {
    assert.match(client, new RegExp(`updateDraft\\(\\"${fuelField}\\"`));
  }

  assert.match(client, /const candidate = request\.candidatePayload \?\? \{\}/);
  assert.match(client, /formValue\(payload\.operatorName, candidate\.operatorName\)/);
  assert.match(client, /formValue\(payload\.workAreaText, candidate\.workAreaText\)/);
});

test("matching uses an admin-scoped customer and destination search instead of raw IDs", () => {
  assert.match(client, /Find customer and destination/);
  assert.match(client, /Search customer, asset, serial or Invoice Drop code/);
  assert.match(client, /selectMatchTarget/);
  assert.doesNotMatch(client, />Owner user ID</);
  assert.match(targetRoute, /searchAdminCaptureTargets/);
  assert.match(targetStore, /from public\.asset_register_items asset/);
  assert.match(targetStore, /from public\.fuel_storage_units storage/);
  assert.match(targetStore, /left join public\.account_profiles profile/);
});

test("pending quarantine files use a private sandboxed inspection before an explicit security decision", () => {
  assert.match(client, /Security decision required/);
  assert.match(client, /private sandboxed preview/);
  assert.match(client, /Mark check passed/);
  assert.doesNotMatch(fileRoute, /locked until its security check passes\.\", 423/);
  assert.match(fileRoute, /file\.securityStatus === "rejected"/);
  assert.match(fileRoute, /setCaptureRequestFileSecurityStatus/);
  assert.match(fileRoute, /readCaptureQuarantineFile/);
  assert.match(fileRoute, /resolveAssetRegisterUploadBytes/);
  assert.match(fileRoute, /Cache-Control": "private, no-store/);
  assert.match(fileRoute, /Content-Security-Policy": "sandbox/);
  assert.match(fileRoute, /X-Aim4price-File-Security-Status/);
});

test("admin workflow exposes guarded claim, draft, information, duplicate, complete and reject actions", () => {
  for (const action of [
    "claim",
    "save_draft",
    "request_information",
    "mark_duplicate",
    "complete",
    "reject",
  ]) {
    assert.match(client, new RegExp(`runAction\\(\\\"${action}\\\"\\)`));
    assert.match(itemRoute, new RegExp(`case \\\"${action}\\\"`));
  }
  assert.match(client, /window\.confirm\("Use these verified details to create the ledger record/);
  assert.match(client, /Add a short reason before using this action/);
});

test("API delegates workflow state and canonical creation to the capture domain", () => {
  assert.match(collectionRoute, /listCaptureRequests/);
  assert.match(collectionRoute, /getCaptureQueueCounts/);
  assert.match(itemRoute, /getCaptureRequestDetail/);
  assert.match(itemRoute, /listCaptureRequestFiles/);
  assert.match(itemRoute, /listCaptureRequestEvents/);
  assert.match(itemRoute, /claimCaptureRequest/);
  assert.match(itemRoute, /updateCaptureRequestDraft/);
  assert.match(itemRoute, /matchCaptureRequest/);
  assert.match(itemRoute, /transitionCaptureRequest/);
  assert.match(itemRoute, /finalizeCaptureRequestForAdmin/);
});
