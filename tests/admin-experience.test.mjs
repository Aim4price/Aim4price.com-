import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const lifecycle = read("app/admin/lifecycle-calculator/lifecycle-calculator-client.tsx");
const lifecycleStyles = read("app/admin/lifecycle-calculator/page.module.css");
const users = read("app/admin/admin-client.tsx");
const userStyles = read("app/admin/page.module.css");
const dashboard = read("app/admin/dashboard/page.tsx");
const dashboardStyles = read("app/admin/dashboard/page.module.css");

test("the one-page lifecycle flow has clear navigation and selectable structures", () => {
  assert.match(lifecycle, /href="#lifecycle-setup"/);
  assert.match(lifecycle, /href="#lifecycle-finance"/);
  assert.match(lifecycle, /href="#lifecycle-provisions"/);
  assert.match(lifecycle, /href="#lifecycle-results"/);
  assert.match(lifecycle, /href="#lifecycle-planning"/);
  assert.match(lifecycle, /aria-pressed=\{scenario\.id === state\.preferredScenario\}/);
  assert.match(lifecycle, /Choose the structure to use in the advice summary/);
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
  assert.match(users, /className=\{`\$\{styles\.adminNavLink\} \$\{styles\.adminNavActive\}`\}/);
  assert.match(users, /Clear filters/);
  assert.match(users, /setSignupDateFilter\("all"\)/);
  assert.match(userStyles, /\.userSummary/);
  assert.match(userStyles, /\.filterPanel/);
  assert.match(userStyles, /\.adminNavActive/);
});

test("selecting an admin account opens an accessible options modal", () => {
  assert.match(users, /onClick=\{\(\) => setAccountActionModal\(user\)\}/);
  assert.match(users, /role="dialog"/);
  assert.match(users, /aria-labelledby="admin-account-action-modal-title"/);
  assert.match(users, /Open account/);
  assert.match(users, /Send password reset/);
  assert.match(users, /Manage asset names/);
  assert.match(users, /Print QR labels/);
  assert.match(users, /Delete account/);
  assert.doesNotMatch(users, /<th>Actions<\/th>/);
  assert.match(userStyles, /\.accountActionGrid/);
  assert.match(userStyles, /\.accountRow:focus-visible/);
  assert.match(userStyles, /min-width: 1710px/);
});

test("the dashboard prioritises headline metrics and collapses optional detail", () => {
  assert.match(dashboard, /Live Aim4price activity/);
  assert.match(dashboard, /At a glance/);
  assert.match(dashboard, /Growth and engagement/);
  assert.match(dashboard, /Asset workspace adoption/);
  assert.match(dashboard, /<details className=\{styles\.detailsSection\}>/);
  assert.match(dashboard, /Detailed product activity/);
  assert.match(dashboard, /styles\.adminButtonActive/);
  assert.match(dashboardStyles, /\.dashboardHero/);
  assert.match(dashboardStyles, /\.featuredCard/);
  assert.match(dashboardStyles, /\.detailsSection\[open\]/);
});
