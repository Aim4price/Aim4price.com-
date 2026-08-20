import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const lifecycle = read("app/admin/lifecycle-calculator/lifecycle-calculator-client.tsx");
const lifecycleStyles = read("app/admin/lifecycle-calculator/page.module.css");
const users = read("app/admin/admin-client.tsx");
const userStyles = read("app/admin/page.module.css");
const adminUsers = read("lib/admin-users.ts");
const adminStorageUsage = read("lib/admin-storage-usage.ts");
const adminDashboard = read("lib/admin-dashboard.ts");
const dashboard = read("app/admin/dashboard/page.tsx");
const dashboardStyles = read("app/admin/dashboard/page.module.css");
const adminNavigation = read("components/AdminNavigation.tsx");
const adminNavigationStyles = read("components/AdminNavigation.module.css");

test("the one-page lifecycle flow has clear navigation and selectable structures", () => {
  assert.match(lifecycle, /href="#lifecycle-setup"/);
  assert.match(lifecycle, /href="#lifecycle-finance"/);
  assert.match(lifecycle, /href="#lifecycle-provisions"/);
  assert.match(lifecycle, /href="#lifecycle-results"/);
  assert.match(lifecycle, /href="#lifecycle-planning"/);
  assert.match(lifecycle, /aria-pressed=\{scenario\.id === state\.preferredScenario\}/);
  assert.match(lifecycle, /Choose the structure to use in the ownership summary/);
  assert.match(lifecycle, /See the cost and cash-flow trade-off clearly/);
  assert.match(lifecycleStyles, /\.workspaceNav \{[\s\S]*?position: sticky/);
  assert.match(lifecycleStyles, /\.scenarioChoiceActive/);
});

test("numeric deal fields are readable and still update the live model", () => {
  assert.match(lifecycle, /new Intl\.NumberFormat\("en-ZA"/);
  assert.match(lifecycle, /inputMode="decimal"/);
  assert.match(lifecycle, /onBlur=\{commitDraft\}/);
  assert.match(lifecycle, /onChange\(parsed\)/);
  assert.doesNotMatch(lifecycle, /<input[\s\S]{0,120}type="number"/);
});

test("service and maintenance choices use plain deal language", () => {
  assert.match(lifecycle, /Use a quoted service-plan amount/);
  assert.match(lifecycle, /Quoted \/ planned service provision/);
  assert.match(lifecycle, /Planned maintenance reserve/);
  assert.match(lifecycle, /Reserve vs future pay-as-you-go/);
  assert.match(lifecycle, /Reserve is above estimated future spend/);
  assert.doesNotMatch(lifecycle, /regression example/);
  assert.doesNotMatch(lifecycle, /<details className=\{styles\.card\} open>/);
});

test("the users page separates navigation, account health and filtering", () => {
  assert.match(users, /<h1>User accounts<\/h1>/);
  assert.match(users, /aria-label="Account summary"/);
  assert.match(users, /accountSummary\.active/);
  assert.match(users, /<AdminNavigation active="accounts" \/>/);
  assert.match(users, /Clear filters/);
  assert.match(users, /setSignupDateFilter\("all"\)/);
  assert.match(userStyles, /\.userSummary/);
  assert.match(userStyles, /\.filterPanel/);
  assert.match(adminNavigation, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(adminNavigationStyles, /\.active/);
  assert.match(adminNavigationStyles, /@media \(max-width: 980px\)/);
  assert.match(adminNavigationStyles, /@media print[\s\S]*?display: none !important/);
});

test("selecting an admin account opens an accessible options modal", () => {
  assert.match(users, /className=\{styles\.rowAccountButton\}/);
  assert.match(users, /role="dialog"/);
  assert.match(users, /aria-labelledby="admin-account-action-modal-title"/);
  assert.match(users, /keepFocusInsideModal/);
  assert.match(users, /accountModalTriggerRef\.current\?\.focus\(\)/);
  assert.match(users, /Start work & open account/);
  assert.match(users, /Open without tracking/);
  assert.match(users, /Send message/);
  assert.match(users, /Send password reset/);
  assert.match(users, /Manage asset names/);
  assert.match(users, /Print QR labels/);
  assert.match(users, /Delete account/);
  assert.doesNotMatch(users, /<th>Actions<\/th>/);
  assert.match(userStyles, /\.accountActionGrid/);
  assert.match(userStyles, /\.accountPrimaryActions/);
  assert.match(userStyles, /\.accountStorageDetails/);
  assert.match(userStyles, /\.accountRow:focus-within/);
  assert.match(userStyles, /min-width: 900px/);
});

test("admin users and pricing metrics share one logical storage ledger", () => {
  assert.match(adminUsers, /with upload_storage as/);
  assert.match(adminUsers, /buildLogicalClientStorageSelect/);
  assert.match(adminDashboard, /buildLogicalClientStorageSelect/);
  assert.match(adminDashboard, /with all_uploads as/);
  assert.match(adminDashboard, /Full estimates saved/);
  assert.doesNotMatch(adminDashboard, /PayFast\/payment logic/);
  assert.match(dashboard, /timeZone: "Africa\/Johannesburg"/);
  assert.doesNotMatch(adminDashboard, /1024 \* 1024/);
  assert.doesNotMatch(
    adminDashboard,
    /sumOctetLengthIfPresent\('account_profiles', 'extra_photo_urls'\)/,
  );
  assert.match(adminDashboard, /sumJsonbTextArrayOctetLengthIfPresent/);
  assert.match(adminStorageUsage, /from public\.asset_register_uploads/);
  assert.match(adminStorageUsage, /from public\.asset_register_bucket_uploads/);
  assert.match(adminStorageUsage, /storage_state = 'ready'/);
  assert.match(adminStorageUsage, /tableName: "account_user_messages"/);
  assert.match(adminStorageUsage, /tableName: "asset_partner_notes"/);
  assert.match(adminStorageUsage, /tableName: "fuel_late_entry_evidence"/);
  assert.match(adminStorageUsage, /logo_url like 'data:image\/%;base64,%'/);
  assert.match(adminStorageUsage, /extra_photo_urls/);
  assert.match(adminStorageUsage, /jsonb_array_elements_text/);
  assert.match(adminStorageUsage, /null::timestamptz as created_at/);
  assert.match(adminUsers, /left join storage_by_user storage on storage\.user_id = u\.id/);
  assert.match(users, /<th>Storage<\/th>/);
  assert.match(users, /accountActionModal\.storageGigabytesLabel/);
  assert.match(users, /accountActionModal\.bucketStorageLabel/);
  assert.match(users, /accountActionModal\.postgresStorageLabel/);
  assert.match(users, /Most storage/);
  assert.match(users, /1000 \*\* 3/);
  assert.match(adminStorageUsage, /1000 \*\* 3/);
  assert.match(users, /Tracked client storage/);
  assert.match(userStyles, /\.accountStorageOverview/);
  assert.match(dashboard, /Average tracked storage \/ account/);
  assert.match(dashboard, /Tracked storage added in the last 30 days/);
  assert.doesNotMatch(dashboard, /central uploads/i);
});

test("the dashboard prioritises headline metrics and collapses optional detail", () => {
  assert.doesNotMatch(dashboard, /Live Aim4price activity/);
  assert.match(dashboard, /At a glance/);
  assert.match(dashboard, /Growth and engagement/);
  assert.match(dashboard, /Asset workspace adoption/);
  assert.match(dashboard, /<details className=\{styles\.detailsSection\}>/);
  assert.match(dashboard, /Detailed product activity/);
  assert.match(dashboard, /<AdminNavigation active="dashboard" \/>/);
  assert.doesNotMatch(dashboard, /className=\{styles\.dashboardHero\}/);
  assert.match(dashboardStyles, /\.featuredCard/);
  assert.match(dashboardStyles, /\.detailsSection\[open\]/);
});

test("all Admin pages use one complete navigation without Assistance Network controls", () => {
  for (const path of [
    "/admin",
    "/admin/dashboard",
    "/admin/work-tracker",
    "/admin/capture-queue",
    "/admin/lifecycle-calculator",
  ]) {
    assert.match(adminNavigation, new RegExp(`href: "${path.replaceAll("/", "\\/")}"`));
  }
  assert.doesNotMatch(adminNavigation, /assistance-network|Assistance Network/);
});
