import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const contactPage = read("app/contact-us/page.tsx");
const homePage = read("app/page.tsx");
const homeStyles = read("app/page.module.css");
const aboutStyles = read("app/about-us/about-us.module.css");
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

test("links the Home hero logo to About Us", () => {
  assert.match(
    homePage,
    /<Link[\s\S]*?href="\/about-us"[\s\S]*?className={styles\.heroVisual}[\s\S]*?aria-label="About Aim4price"/,
  );
  assert.doesNotMatch(
    homePage,
    /className={styles\.heroVisual}\s+aria-hidden="true"/,
  );
  assert.match(homeStyles, /\.heroVisual:hover/);
  assert.match(homeStyles, /pointer-events:\s*auto/);
});

test("aligns the founder and contact boxes within the hero layout", () => {
  assert.match(contactPage, /styles\.heroContactDetails/);
  assert.match(
    contactPage,
    /className={styles\.portraitFrame}[\s\S]*?className={styles\.founderCard}/,
  );
  assert.match(aboutStyles, /\.heroContactDetails\s*{[\s\S]*?grid-template-columns:\s*repeat\(2/);
  assert.match(aboutStyles, /\.founderCard\s*{[\s\S]*?right:\s*1rem;[\s\S]*?left:\s*1rem/);
});

test("uses one global background and keeps new public copy free of em dashes", () => {
  assert.match(
    rootLayout,
    /<AppPatternBackground>{children}<\/AppPatternBackground>/,
  );
  assert.equal(contactPage.includes("\u2014"), false);
  assert.equal(homePage.includes("\u2014"), false);
});
