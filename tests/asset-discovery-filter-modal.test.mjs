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

test("Recently advertised filter uses the same wider dialog layout", () => {
  assert.match(
    css,
    /\.recentAdvertFilterModal\.recentAdvertFilterModal\[role='dialog'\]\s*\{[\s\S]*?width:\s*min\(calc\(calc\(var\(--website-design-vw(?:, 1vw)?\) \* 100\) - 2rem\), 64rem\)\s*!important;/,
  );
  assert.match(
    css,
    /\.recentAdvertFilterFields\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)\s*\{[\s\S]*?\.recentAdvertFilterFields,[\s\S]*?grid-template-columns:\s*1fr;/,
  );
});

test("Recently advertised filters use branded custom listboxes", () => {
  const filterDropdown = recentAdvertsClient.slice(
    recentAdvertsClient.indexOf("function RecentAdvertFilterDropdown("),
    recentAdvertsClient.indexOf("function ContactSentIcon("),
  );
  const filterModal = recentAdvertsClient.slice(
    recentAdvertsClient.indexOf("{filterOpen ? ("),
    recentAdvertsClient.indexOf("{sourcingRequest ? ("),
  );

  assert.match(filterDropdown, /aria-haspopup="listbox"/);
  assert.match(
    filterDropdown,
    /aria-controls=\{isOpen \? listboxId : undefined\}/,
  );
  assert.match(filterDropdown, /<DropdownOverlay[\s\S]*?role="listbox"/);
  assert.match(filterDropdown, /role="option"/);
  assert.match(filterDropdown, /aria-selected=\{isSelected\}/);
  assert.match(filterDropdown, /event\.key === "ArrowDown"/);
  assert.match(filterDropdown, /event\.key === "Home"/);
  assert.match(filterDropdown, /event\.key === "End"/);
  assert.match(filterDropdown, /event\.key === "Escape"/);
  assert.match(filterDropdown, /event\.key === "Tab"/);
  assert.match(filterDropdown, /tabIndex=\{isSelected \? 0 : -1\}/);
  assert.equal(
    (filterModal.match(/<RecentAdvertFilterDropdown/g) ?? []).length,
    3,
  );
  assert.doesNotMatch(filterModal, /<select\b|<option\b/);
});

test("Recently advertised filter dialog exposes its description", () => {
  assert.match(
    recentAdvertsClient,
    /aria-describedby="recent-advert-filter-description"/,
  );
  assert.match(recentAdvertsClient, /id="recent-advert-filter-description"/);
});

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
