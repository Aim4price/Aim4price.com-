import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const pages = {
  accounts: read("app/admin/admin-client.tsx"),
  dashboard: read("app/admin/dashboard/page.tsx"),
  valuations: read("app/admin/valuations/page.tsx"),
  marketplace: read("app/admin/marketplace/page.tsx"),
  map: read("app/admin/asset-map/page.tsx"),
  discovery: read("app/admin/discovery/page.tsx"),
  outcomes: read("app/admin/sold-assets/page.tsx"),
  work: read("app/admin/work-tracker/work-tracker-client.tsx"),
  capture: read("app/admin/capture-queue/page.tsx"),
  lifecycle: read("app/admin/lifecycle-calculator/page.tsx"),
};

const navigation = read("components/AdminNavigation.tsx");
const navigationStyles = read("components/AdminNavigation.module.css");
const foundation = read("app/admin/admin-foundation.css");
const loading = read("app/admin/loading.tsx");
const dashboard = read("app/admin/dashboard/page.tsx");
const dashboardStyles = read("app/admin/dashboard/page.module.css");
const mapClient = read("app/admin/asset-map/admin-asset-map-client.tsx");
const lifecycleClient = read("app/admin/lifecycle-calculator/lifecycle-calculator-client.tsx");
const marketplaceStyles = read("app/admin/marketplace/page.module.css");
const outcomeStyles = read("app/admin/sold-assets/page.module.css");
const accountStyles = read("app/admin/page.module.css");
const accountPicker = read("app/admin/work-tracker/account-picker.tsx");

test("every Admin workspace uses one concise page title", () => {
  const expectedTitles = {
    accounts: "Accounts",
    dashboard: "Dashboard",
    valuations: "Valuations",
    marketplace: "Marketplace",
    map: "Asset Map",
    discovery: "Discovery",
    outcomes: "Outcomes",
    work: "Work tracker",
    capture: "Capture Queue",
    lifecycle: "Lifecycle Model",
  };

  for (const [key, title] of Object.entries(expectedTitles)) {
    assert.match(pages[key], new RegExp(`<h1>${title}<\\/h1>`));
    assert.doesNotMatch(
      pages[key],
      /className=\{styles\.titleBlock\}[\s\S]{0,240}<h1[^>]*>[^<]+<\/h1>[\s\S]{0,120}<(p|small|span)/,
    );
  }
});

test("Manage navigation is label-only and contains no status pills", () => {
  assert.match(navigation, />Manage<\/strong>/);
  assert.match(navigation, /label: "Asset Map"/);
  assert.match(navigation, /label: "Outcomes"/);
  assert.doesNotMatch(navigation, /description:|>Open<|>Current<|tagline|eyebrow/);
  assert.match(navigationStyles, /\.link \{[\s\S]*?border-radius: 0\.75rem/);
  assert.doesNotMatch(navigationStyles, /border-radius:\s*999px/);
});

test("loading and summary surfaces contain no decorative copy", () => {
  assert.match(loading, /aria-label="Loading Admin"/);
  assert.doesNotMatch(loading, /Opening your Admin workspace|Loading Admin data|styles\.pill|styles\.subtitle|styles\.status/);
  assert.doesNotMatch(dashboard, /item\.detail/);
  assert.match(foundation, /\[class\*="titleBlock"\] h1\)[\s\S]*?white-space: nowrap/);
  assert.match(foundation, /\[class\*="pill"\][\s\S]*?border-radius: 0 !important/);
});

test("map and lifecycle remove redundant labels while preserving their actions", () => {
  assert.doesNotMatch(mapClient, /markerNumber|index \+ 1|<br>|>Refresh</);
  assert.match(mapClient, /setInterval/);
  assert.match(mapClient, /Open owner/);
  assert.doesNotMatch(lifecycleClient, /\{help \? <small>|\{detail \? <small>/);
  assert.match(lifecycleClient, /Funding structure/);
  assert.match(lifecycleClient, /Structure comparison/);
});

test("status values are plain text rather than pills", () => {
  assert.match(marketplaceStyles, /\.badge \{[\s\S]*?padding: 0;[\s\S]*?border: 0;[\s\S]*?border-radius: 0;/);
  assert.match(outcomeStyles, /\.yesAnswer,[\s\S]*?padding: 0;[\s\S]*?border: 0;[\s\S]*?border-radius: 0;/);
  assert.match(accountStyles, /\.nameStatusText \{[\s\S]*?padding: 0;[\s\S]*?border-radius: 0;/);
});

test("compact controls keep labels and modal titles on one line", () => {
  assert.doesNotMatch(accountPicker, /<small>\{option\.description\}<\/small>/);
  assert.match(accountStyles, /\.qrModalHeader h2 \{[\s\S]*?text-overflow: ellipsis;[\s\S]*?white-space: nowrap;/);
  assert.doesNotMatch(accountStyles, /\.qrModalHeader h2,[\s\S]{0,500}white-space: normal;/);
  assert.doesNotMatch(accountStyles, /white-space:\s*normal/);
  assert.doesNotMatch(dashboardStyles, /white-space:\s*normal/);
});
