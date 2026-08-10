import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const contactPage = read("app/contact-us/page.tsx");
const homePage = read("app/page.tsx");
const homeStyles = read("app/page.module.css");
const rootLayout = read("app/layout.tsx");
const portraitPath = new URL(
  "../public/about/kuyler-geldenhuys.jpg",
  import.meta.url,
);

test("publishes Contact Us with the founder details and supplied portrait", () => {
  assert.doesNotMatch(contactPage, /notFound\s*\(/);
  assert.match(contactPage, /Kuyler Chris Geldenhuys/);
  assert.match(contactPage, /062 572 1650/);
  assert.match(contactPage, /aim4price@gmail\.com/);
  assert.match(contactPage, /\/about\/kuyler-geldenhuys\.jpg/);
  assert.ok(existsSync(portraitPath));
});

test("links the Home hero logo to Contact Us", () => {
  assert.match(
    homePage,
    /<Link[\s\S]*?href="\/contact-us"[\s\S]*?className={styles\.heroVisual}[\s\S]*?aria-label="Contact Aim4price"/,
  );
  assert.doesNotMatch(
    homePage,
    /className={styles\.heroVisual}\s+aria-hidden="true"/,
  );
  assert.match(homeStyles, /\.heroVisual:hover/);
  assert.match(homeStyles, /pointer-events:\s*auto/);
});

test("uses one global background and keeps new public copy free of em dashes", () => {
  assert.match(
    rootLayout,
    /<AppPatternBackground>{children}<\/AppPatternBackground>/,
  );
  assert.equal(contactPage.includes("\u2014"), false);
  assert.equal(homePage.includes("\u2014"), false);
});
