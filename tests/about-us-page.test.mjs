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
  assert.match(pageSource, /href="\/contact-us"/);
});

test("shares the approved origin story and attributes it to Kuyler Geldenhuys", () => {
  for (const detail of [/trade-in values/, /second-hand tractors/, /accounting records/, /each individual asset/, /From our founder/]) {
    assert.match(pageSource, detail);
  }
  assert.match(pageSource, /We believe better asset information could help lenders assess/);
  assert.match(pageSource, /That is our longer-term ambition/);
  assert.match(pageSource, /Kuyler Geldenhuys/);
  assert.doesNotMatch(pageSource, /Kuyler Chris Geldenhuys/);
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
