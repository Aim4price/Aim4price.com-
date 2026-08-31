import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const client = read("app/asset-discovery/asset-discovery-client.tsx");
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
    /\.discoveryFilterModal\.discoveryFilterModal\[role='dialog'\]\s*\{[\s\S]*?max-height:[\s\S]*?!important;[\s\S]*?overflow:\s*hidden\s*!important;/,
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
