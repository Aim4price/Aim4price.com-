import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const contactPage = read("app/contact-us/page.tsx");
const aboutStyles = read("app/about-us/about-us.module.css");
const rootLayout = read("app/layout.tsx");

test("publishes Contact Us with actionable founder details and the supplied portrait", () => {
  assert.doesNotMatch(contactPage, /notFound\s*\(/);
  assert.match(contactPage, /Kuyler Chris Geldenhuys/);
  assert.match(contactPage, /href="tel:\+27625721650"/);
  assert.match(contactPage, /062 572 1650/);
  assert.match(contactPage, /href="mailto:aim4price@gmail\.com"/);
  assert.match(contactPage, /\/about\/kuyler-geldenhuys\.jpg/);
  assert.ok(existsSync(new URL("../public/about/kuyler-geldenhuys.jpg", import.meta.url)));
});

test("keeps contact focused on support and links to About Us for product details", () => {
  assert.match(contactPage, /href="\/about-us"/);
  assert.match(contactPage, /Need help getting started/);
  assert.doesNotMatch(contactPage, /fairer financing|insurance pricing|better cover|OUR DIRECTION|WHY AIM4PRICE EXISTS/);
  assert.doesNotMatch(contactPage, />\s*(?:CONTACT AIM4PRICE|FOUNDER|PHONE|EMAIL)\s*</);
});

test("shares the public styling and exposes keyboard focus for contact actions", () => {
  assert.match(contactPage, /\.\.\/about-us\/about-us\.module\.css/);
  assert.match(contactPage, /<address className={styles\.contactDetails}>/);
  assert.match(aboutStyles, /\.contactLink:focus-visible/);
  assert.match(aboutStyles, /\.textLink:focus-visible/);
});

test("preserves the public layout and account guard", () => {
  assert.match(contactPage, /<AppHeader active="none"/);
  assert.match(contactPage, /await redirectAdminToAdmin\(\)/);
  assert.match(rootLayout, /<AppPatternBackground>{children}<\/AppPatternBackground>/);
  assert.equal(contactPage.includes("\u2014"), false);
});
