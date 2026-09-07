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

test("Discovery filter header keeps its own padded layout", () => {
  assert.match(client, /styles\.discoveryFilterHeader/);
  assert.match(client, /styles\.discoveryFilterHeaderCopy/);
  assert.match(
    css,
    /\.discoveryFilterModal \.discoveryFilterHeader\s*\{[\s\S]*?margin:\s*0\s*!important;[\s\S]*?padding:\s*1\.55rem 5rem 1\.35rem 1\.7rem\s*!important;/,
  );
  assert.match(
    css,
    /\.discoveryFilterHeaderCopy\s*\{[\s\S]*?gap:\s*0\.48rem;/,
  );
  assert.match(
    css,
    /\.discoveryFilterHeaderCopy > h3,[\s\S]*?\.discoveryFilterHeaderCopy > p\s*\{[\s\S]*?margin:\s*0\s*!important;/,
  );
});

test("Discovery filter header preserves close-button space on mobile", () => {
  assert.match(
    css,
    /@media \(max-width: 760px\)\s*\{[\s\S]*?\.discoveryFilterModal \.discoveryFilterHeader\s*\{[\s\S]*?padding:\s*1\.2rem 4\.3rem 1\.05rem 1\.2rem\s*!important;/,
  );
});

test("Discovery filter body stays usable in short and narrow viewports", () => {
  assert.match(
    css,
    /\.discoveryFilterModal\.discoveryFilterModal\[role='dialog'\]\s*\{[\s\S]*?width:\s*min\(calc\(calc\(var\(--website-design-vw(?:, 1vw)?\) \* 100\) - 2rem\), 64rem\)\s*!important;[\s\S]*?max-height:[\s\S]*?!important;[\s\S]*?overflow:\s*hidden\s*!important;/,
  );
  assert.match(
    css,
    /\.discoveryFilterForm\s*\{[\s\S]*?flex:\s*1 1 auto\s*!important;[\s\S]*?min-height:\s*0\s*!important;[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)[\s\S]*?overflow-y:\s*auto\s*!important;/,
  );
  assert.match(
    css,
    /@media \(max-width: 900px\)\s*\{[\s\S]*?\.discoveryFilterForm\s*\{[\s\S]*?grid-template-columns:\s*1fr\s*!important;/,
  );
});

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

test("Discovery filters remain branded custom listboxes", () => {
  const filterDropdown = client.slice(
    client.indexOf("function DiscoveryFilterDropdown("),
    client.indexOf("function cleanText("),
  );
  const filterModal = client.slice(
    client.indexOf("{!compactAppMode && isFilterModalOpen ? ("),
    client.indexOf(
      'access?.accountType === "owner"',
      client.indexOf("{!compactAppMode && isFilterModalOpen ? ("),
    ),
  );

  assert.match(filterDropdown, /aria-haspopup="listbox"/);
  assert.match(filterDropdown, /<DropdownOverlay[\s\S]*?role="listbox"/);
  assert.match(filterDropdown, /role="option"/);
  assert.match(filterDropdown, /aria-selected=\{isSelected\}/);
  assert.equal(
    (filterModal.match(/<DiscoveryFilterDropdown/g) ?? []).length,
    5,
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

test("Discovery filter dialog exposes its description to assistive technology", () => {
  assert.match(
    client,
    /aria-describedby="discovery-filter-description"/,
  );
  assert.match(client, /id="discovery-filter-description"/);
});

test("Discovery filter retains its fields and explicit actions", () => {
  const filterModal = client.slice(
    client.indexOf("{!compactAppMode && isFilterModalOpen ? ("),
    client.indexOf("access?.accountType === \"owner\"", client.indexOf("{!compactAppMode && isFilterModalOpen ? (")),
  );

  assert.match(filterModal, /label="Asset type"/);
  assert.match(filterModal, /label="Province"/);
  assert.match(filterModal, /label="Assets per page"/);
  assert.match(filterModal, /label="Renewal timing"/);
  assert.match(filterModal, /label="Opportunity status"/);
  assert.match(filterModal, /onClick=\{resetDiscoveryFilters\}/);
  assert.match(filterModal, /disabled=\{!hasActiveDiscoveryFilter\}/);
  assert.match(filterModal, /onClick=\{closeDiscoveryFilterModal\}/);
  assert.match(filterModal, /Reset filters/);
  assert.match(filterModal, /Apply filters/);
});

