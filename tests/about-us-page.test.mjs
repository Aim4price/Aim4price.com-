import { assertNoWebsiteReflow } from './helpers/site-layout-audit.mjs';
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const pageSource = read("app/about-us/page.tsx");
const stylesSource = read("app/about-us/about-us.module.css");
const rootLayoutSource = read("app/layout.tsx");

test("publishes About Us with the existing public layout and account guard", () => {
  assert.doesNotMatch(pageSource, /notFound\s*\(/);
  assert.match(pageSource, /<AppHeader active="none"/);
  assert.match(pageSource, /await redirectAdminToAdmin\(\)/);
  assert.doesNotMatch(pageSource, /<AppPatternBackground>/);
  assert.match(rootLayoutSource, /<AppPatternBackground>{children}<\/AppPatternBackground>/);
  assert.match(pageSource, /href="\/auth#signup"/);
  assert.match(pageSource, /href="\/valuation"/);
  assert.match(pageSource, /href="\/contact-us"/);
});

test("describes current ownership tools and retains the founder", () => {
  for (const feature of [/indicative values/, /documents/, /expenses and fuel/, /budgets/, /maintenance/, /checklists/]) {
    assert.match(pageSource, feature);
  }
  assert.doesNotMatch(pageSource, /fairer financing|insurance pricing|better cover|every trusted partner/i);
  assert.match(pageSource, /Kuyler Chris Geldenhuys/);
  assert.match(pageSource, /\/about\/kuyler-geldenhuys\.jpg/);
  assert.ok(existsSync(new URL("../public/about/kuyler-geldenhuys.jpg", import.meta.url)));
});

test("uses sentence case labels and preserves the website canvas layout", () => {
  assertNoWebsiteReflow(stylesSource, "app/about-us/about-us.module.css");
  assert.doesNotMatch(pageSource, />\s*(?:ABOUT AIM4PRICE|FOUNDER|OUR MISSION|OUR VISION)\s*</);
  assert.doesNotMatch(stylesSource, /text-transform:\s*uppercase/);
  assert.equal(pageSource.includes("\u2014"), false);
  assert.equal(stylesSource.includes("\u2014"), false);
});
