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
  adminNavigation,
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
  read("components/AdminNavigation.tsx"),
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
  assert.match(adminNavigation, /href: "\/admin\/capture-queue"/);
  assert.match(adminNavigation, /label: "Capture Queue"/);
  assert.match(page, /<AdminNavigation active="capture-queue" \/>/);
  assert.match(usersPage, /<AdminNavigation active="accounts" \/>/);
  assert.match(dashboardPage, /<AdminNavigation active="dashboard" \/>/);
  assert.match(lifecyclePage, /<AdminNavigation active="lifecycle" \/>/);
  assert.doesNotMatch(adminNavigation, /assistance-network/);
});

test("queue prioritises deadline work and includes useful operational filters", () => {
  assert.match(client, /sortOverdueFirst/);
  assert.match(client, /Overdue/);
  assert.match(client, /Due in 24 hours/);
  assert.match(client, /Needs information/);
  assert.match(client, /Awaiting owner/);
  assert.match(client, /Completed today/);
  assert.match(client, /Reference, sender, customer or asset/);
  assert.match(client, /Public Invoice Drop/);
  assert.match(styles, /\.kpiGrid/);
  assert.match(styles, /\.kpiSelected/);
  assert.match(styles, /\.queueTableWrap/);
  assert.match(client, /aria-pressed=\{statusFilter === kpi\.filter\}/);
  assert.match(client, /role=\{notice\.tone === "error" \? "alert" : "status"\}/);
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
  assert.match(client, /Submitted serial or VIN/);
  assert.match(client, /submittedAssetDescription/);
  assert.match(client, /exact_unique_serial_or_vin[\s\S]*?Auto-matched/);
  assert.match(client, /Internal admin note/);
  assert.match(client, /Audit history/);
  assert.match(client, /\/api\/admin\/capture-requests\/\$\{encodeURIComponent\(requestId\)\}/);
  assert.match(client, /detailLoadGenerationRef/);
  assert.match(client, /queueLoadGenerationRef/);
  assert.match(client, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(client, /Discard the unsaved changes in this capture request/);
  assert.match(client, /beforeunload/);
  assert.doesNotMatch(client, /<iframe sandbox=""/);
  assert.match(client, /<iframe referrerPolicy="no-referrer"/);
  assert.match(client, /activeFile\.securityStatus === "clean"/);
  assert.match(styles, /grid-template-columns: minmax\(25rem, 0\.95fr\) minmax\(32rem, 1\.05fr\)/);
  assert.match(styles, /\.submittedAssetReference/);
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

test("pre-matched requests show the authoritative saved destination and keep search locked", () => {
  assert.match(itemRoute, /getAdminCaptureTarget/);
  assert.match(itemRoute, /matchedTarget/);
  assert.match(itemRoute, /matchedTarget\?\.ownerDisplayName/);
  assert.match(itemRoute, /matchedTarget\?\.targetType === "asset"/);
  assert.match(targetStore, /export async function getAdminCaptureTarget/);
  assert.match(targetStore, /export async function getAdminCaptureTargets/);
  assert.match(targetStore, /select \* from unnest\(\$1::text\[\], \$2::text\[\]\)/);
  assert.match(targetStore, /asset\.id::text = requested\.target_id[\s\S]*?asset\.user_id::text = requested\.owner_user_id/);
  assert.match(targetStore, /storage\.id::text = requested\.target_id[\s\S]*?storage\.user_id::text = requested\.owner_user_id/);
  assert.match(client, /request\.ownerUserId \|\| cleanText\(payload\.ownerUserId\)/);
  assert.match(client, /request\.assetId \|\| cleanText\(payload\.assetId\)/);
  assert.match(client, /Identified destination — confirm before completing/);
  assert.match(client, /selectedTarget\.targetDisplayName/);
  assert.match(client, /selectedTarget\.reference/);
  assert.match(client, /!hasMatchedTarget \|\| isChangingMatch/);
});

test("queue rows batch-hydrate canonical owner and destination names", () => {
  assert.match(collectionRoute, /getAdminCaptureTargets/);
  assert.match(collectionRoute, /visibleRequests\.map\(\(entry\) => \(\{[\s\S]*?ownerUserId: entry\.ownerUserId,[\s\S]*?assetId: entry\.assetId,[\s\S]*?fuelStorageId: entry\.fuelStorageId/);
  assert.match(collectionRoute, /adminCaptureTargetKey\(\{[\s\S]*?ownerUserId: entry\.ownerUserId,[\s\S]*?assetId: entry\.assetId,[\s\S]*?fuelStorageId: entry\.fuelStorageId/);
  assert.match(collectionRoute, /matchedTarget\?\.ownerDisplayName \|\|[\s\S]*?payloadText\(payload, "ownerDisplayName"/);
  assert.match(collectionRoute, /matchedTarget\?\.targetType === "asset" \? matchedTarget\.targetDisplayName/);
  assert.match(collectionRoute, /matchedTarget\?\.targetType === "fuel_storage" \? matchedTarget\.targetDisplayName/);
});

test("canonical asset targets expose saved usage and every serial or VIN alias", () => {
  assert.match(targetStore, /import \{ resolveAssetUsage \} from "\.\/asset-usage"/);
  assert.match(targetStore, /assetUsageMetric: "hours" \| "km" \| "percentage" \| "not_applicable" \| null/);
  assert.match(targetStore, /assetUsageReading: number \| null/);
  assert.match(targetStore, /asset\.kind as asset_kind/);
  assert.match(targetStore, /asset\.hours as asset_hours/);
  assert.match(targetStore, /asset\.life_worked_percent as asset_life_worked_percent/);
  assert.match(targetStore, /asset\.specs_json as asset_specs_json/);
  assert.match(targetStore, /resolveAssetUsage\(\{[\s\S]*?kind: row\.asset_kind,[\s\S]*?hours: row\.asset_hours,[\s\S]*?lifeWorkedPercent: row\.asset_life_worked_percent,[\s\S]*?specsJson: row\.asset_specs_json/);
  for (const alias of ["serial_number", "serial", "vin", "serialNumber"]) {
    assert.match(targetStore, new RegExp(`to_jsonb\\(asset\\)->>'${alias}'`));
  }
});

test("changing a match preserves the current target until a replacement is chosen", () => {
  const changeStart = client.indexOf("function beginMatchChange()");
  const changeEnd = client.indexOf("function cancelMatchChange()", changeStart);
  const changeHandler = client.slice(changeStart, changeEnd);

  assert.ok(changeStart >= 0 && changeEnd > changeStart);
  assert.match(changeHandler, /setIsChangingMatch\(true\)/);
  assert.doesNotMatch(changeHandler, /ownerUserId: ""|assetId: ""|fuelStorageId: ""/);
  assert.match(client, /The current match stays in place until you choose and confirm a replacement/);
  assert.match(client, /onClick=\{isChangingMatch \? cancelMatchChange : beginMatchChange\}/);
  assert.match(client, /setSelectedTarget\(target\)/);
  assert.match(client, /setIsChangingMatch\(false\)/);
});

test("completion requires an actor-attributed confirmation of the exact current target", () => {
  assert.match(client, /runAction\("confirm_match"\)/);
  assert.match(client, /Confirm this exact asset/);
  assert.match(client, /event\.eventType === "matched"/);
  assert.match(client, /targetKey\(latestMatch\.metadata\) === currentTargetKey/);
  assert.match(client, /disabled=\{Boolean\(busyAction\) \|\| !isMatchConfirmed\}/);
  assert.match(client, /requestVersion: detail\?\.version/);
  assert.match(itemRoute, /case "confirm_match"/);
  assert.match(itemRoute, /saveAdminDraft\(existing, draft, actor, \{ confirmMatch: true \}\)/);
  assert.match(itemRoute, /event\.eventType === "matched"/);
  assert.match(itemRoute, /CAPTURE_TARGET_CONFIRMATION_REQUIRED/);
  assert.match(itemRoute, /target\.changed && !options\.confirmMatch/);
  assert.match(itemRoute, /CAPTURE_TARGET_CHANGE_REQUIRES_CONFIRMATION/);
  assert.match(itemRoute, /metadata: event\.metadata/);
});

test("pending quarantine files use a private Chrome-compatible inspection before an explicit security decision", () => {
  assert.match(client, /Security decision required/);
  assert.match(client, /private preview/);
  assert.match(client, /<iframe referrerPolicy="no-referrer"/);
  assert.match(client, /activeFile\?\.downloadUrl && activeFile\.securityStatus === "clean"/);
  assert.match(client, /Mark check passed/);
  assert.doesNotMatch(fileRoute, /locked until its security check passes\.\", 423/);
  assert.match(fileRoute, /file\.securityStatus === "rejected"/);
  assert.match(fileRoute, /setCaptureRequestFileSecurityStatus/);
  assert.match(fileRoute, /CAPTURE_FINALIZATION_IN_PROGRESS[\s\S]*?409/);
  assert.match(fileRoute, /readCaptureQuarantineFile/);
  assert.match(fileRoute, /resolveAssetRegisterUploadBytes/);
  assert.match(fileRoute, /Cache-Control": "private, no-store/);
  assert.match(fileRoute, /input\.contentType === "application\/pdf"/);
  assert.match(fileRoute, /headers\["X-Frame-Options"\] = "SAMEORIGIN"/);
  assert.match(fileRoute, /headers\["Content-Security-Policy"\] = "sandbox; default-src 'none'"/);
  assert.match(fileRoute, /X-Aim4price-File-Security-Status/);
  assert.match(fileRoute, /HIDDEN_TERMINAL_STATUSES\.has\(capture\.status\)/);
});

test("admin workflow exposes guarded claim, draft, information, duplicate, complete and reject actions", () => {
  for (const action of [
    "claim",
    "confirm_match",
    "save_draft",
    "request_information",
    "mark_duplicate",
    "complete",
    "complete_direct",
    "reject",
    "delete",
  ]) {
    assert.match(client, new RegExp(`runAction\\(\\\"${action}\\\"\\)`));
    assert.match(itemRoute, new RegExp(`case \\\"${action}\\\"`));
  }
  assert.match(client, /window\.confirm\("Use these verified details to create the ledger record/);
  assert.match(client, /Add a short reason before using this action/);
});

test("external approval override and queue deletion are deliberate audited actions", async () => {
  const finalizer = await read("lib/capture-finalization.ts");
  const cleanupMigration = await read("database/migrations/84-assisted-capture-file-lifecycle.sql");

  assert.match(client, /Save directly — owner approved/);
  assert.match(client, /How was the owner's approval confirmed/);
  assert.match(itemRoute, /case "complete_direct"/);
  assert.match(itemRoute, /ownerApprovalOverrideReason: note/);
  assert.match(finalizer, /ownerApprovalOverrideReason/);
  assert.match(finalizer, /ownerApproved: ownerApprovalOverridden/);

  assert.match(client, /Delete capture request/);
  assert.match(client, /Type \$\{detail\?\.publicReference/);
  assert.match(client, /runAction\("delete"\)/);
  assert.match(client, /setSelectedId\(""\)/);
  assert.match(client, /<option value="cancelled">Deleted<\/option>/);
  assert.match(itemRoute, /case "delete"/);
  assert.match(itemRoute, /cancelCaptureRequestForAdmin/);
  assert.match(finalizer, /withFinalizationLock\(requestId/);
  assert.match(finalizer, /transitionCaptureRequest\(request\.id, 'cancelled'/);
  assert.doesNotMatch(finalizer, /delete from public\.document_capture_(requests|files|events)/);
  assert.match(cleanupMigration, /new\.status not in \('declined', 'rejected', 'cancelled'\)/);
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
