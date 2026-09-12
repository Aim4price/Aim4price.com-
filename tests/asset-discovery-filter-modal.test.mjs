import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const client = read("app/asset-discovery/asset-discovery-client.tsx");
const recentAdvertsClient = read(
  "app/asset-discovery/recently-advertised-client.tsx",
);
const css = read("app/asset-discovery/page.module.css");

test("desktop Discovery has no filter button, modal or hidden filter handlers", () => {
  assert.doesNotMatch(client, /isFilterModalOpen|openDiscoveryFilterModal|closeDiscoveryFilterModal|resetDiscoveryFilters|DiscoveryFilterDropdown|discovery-filter-title|activeDiscoveryFilterLabel/);
  assert.doesNotMatch(css, /\.discoveryFilterModal/);
  assert.match(client, /aria-label="Search Asset Discovery"/);
  assert.match(client, /if \(compactAppMode && province !== "all"\)/);
  assert.match(client, /if \(compactAppMode && type !== "all"\)/);
});

test("Discovery settings reuse the Change Password dialog design", () => {
  for (const name of ['modalTheme', 'modalBackdrop', 'modalCard', 'accountScrollableModalCard', 'passwordModalCard', 'accountModalScrollContent', 'modalHeader', 'modalCloseButton', 'passwordModalIntro', 'modalActions', 'ghostButton', 'dangerButton']) {
    assert.ok(client.includes(`accountStyles.${name}`), `Missing shared account style: ${name}`);
  }
  assert.match(client, /<h2 id="discovery-settings-title">/);
  assert.match(client, /aria-describedby="discovery-settings-description"/);
  assert.match(client, /settingsDialogRef\.current\?\.focus/);
});

test("Recently advertised has search and refresh without a filter modal", () => {
  assert.doesNotMatch(recentAdvertsClient, /FilterIcon|RecentAdvertFilterDropdown|filterOpen|openFilterModal|resetFilters/);
  assert.doesNotMatch(recentAdvertsClient, /params\.set\("(?:status|type|province)"/);
  assert.doesNotMatch(css, /\.recentAdvertFilter/);
  assert.match(recentAdvertsClient, /Search recently advertised equipment/);
  assert.match(recentAdvertsClient, /adverts for the current search/);
});
