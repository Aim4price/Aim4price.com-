import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const pagePath = new URL("../app/about-us/page.tsx", import.meta.url);
const stylesPath = new URL(
  "../app/about-us/about-us.module.css",
  import.meta.url,
);
const portraitPath = new URL(
  "../public/about/kuyler-geldenhuys.jpg",
  import.meta.url,
);

const pageSource = readFileSync(pagePath, "utf8");
const stylesSource = readFileSync(stylesPath, "utf8");

test("publishes the About Us route with the Aim4price public layout", () => {
  assert.doesNotMatch(pageSource, /notFound\s*\(/);
  assert.match(pageSource, /<AppHeader active="none"/);
  assert.match(pageSource, /<AppPatternBackground>/);
  assert.match(pageSource, /Better asset information\./);
});

test("includes the mission, vision and founder contact information", () => {
  assert.match(pageSource, /OUR MISSION/);
  assert.match(pageSource, /OUR VISION/);
  assert.match(pageSource, /Kuyler Chris Geldenhuys/);
  assert.match(pageSource, /062 572 1650/);
  assert.match(pageSource, /aim4price@gmail\.com/);
  assert.ok(existsSync(portraitPath));
});

test("keeps the About Us page responsive and free of em dashes", () => {
  assert.match(stylesSource, /@media \(max-width: 800px\)/);
  assert.match(stylesSource, /@media \(max-width: 560px\)/);
  assert.equal(pageSource.includes("\u2014"), false);
  assert.equal(stylesSource.includes("\u2014"), false);
});
