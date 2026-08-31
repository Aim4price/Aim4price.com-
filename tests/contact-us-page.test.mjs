import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const portraitPath = new URL(
  "../public/about/kuyler-geldenhuys.jpg",
  import.meta.url,
);

test("publishes Contact Us with the founder details and supplied portrait", () => {
  const contactPage = read("app/contact-us/page.tsx");

  assert.doesNotMatch(contactPage, /notFound\s*\(/);
  assert.match(contactPage, /Kuyler Chris Geldenhuys/);
  assert.match(contactPage, /062 572 1650/);
  assert.match(contactPage, /aim4price@gmail\.com/);
  assert.match(contactPage, /\/about\/kuyler-geldenhuys\.jpg/);
  assert.ok(existsSync(portraitPath));
});

test("links the Home platform action to About Us", () => {
  const homePage = read("app/page.tsx");
  const homeStyles = read("app/page.module.css");

  assert.match(
    homePage,
    /<Link href="\/about-us" className={styles\.secondaryCta}>[\s\S]*?Explore the platform/,
  );
  assert.match(homeStyles, /\.secondaryCta:hover/);
  assert.match(homeStyles, /\.secondaryCta:focus-visible/);
});

test("aligns the founder and contact boxes within the hero layout", () => {
  const contactPage = read("app/contact-us/page.tsx");
  const aboutStyles = read("app/about-us/about-us.module.css");

  assert.match(contactPage, /styles\.heroContactDetails/);
  assert.match(
    contactPage,
    /className={styles\.portraitFrame}[\s\S]*?className={styles\.founderCard}/,
  );
  assert.match(aboutStyles, /\.heroContactDetails\s*{[\s\S]*?grid-template-columns:\s*repeat\(2/);
  assert.match(aboutStyles, /\.founderCard\s*{[\s\S]*?right:\s*1rem;[\s\S]*?left:\s*1rem/);
});

test("uses one global background and keeps new public copy free of em dashes", () => {
  const contactPage = read("app/contact-us/page.tsx");
  const homePage = read("app/page.tsx");
  const rootLayout = read("app/layout.tsx");

  assert.match(
    rootLayout,
    /<AppPatternBackground>{children}<\/AppPatternBackground>/,
  );
  assert.equal(contactPage.includes("\u2014"), false);
  assert.equal(homePage.includes("\u2014"), false);
});
