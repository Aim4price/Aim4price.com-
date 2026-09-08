import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootLayoutPath = new URL('../app/layout.tsx', import.meta.url);
const homePagePath = new URL('../app/page.tsx', import.meta.url);
const homeStylesPath = new URL('../app/page.module.css', import.meta.url);
const homeVideoPath = new URL('../app/home-hero-video.tsx', import.meta.url);
const valuationPagePath = new URL('../app/valuation/page.tsx', import.meta.url);
const valuationPolishPath = new URL('../app/valuation/ValuationFlowPolish.tsx', import.meta.url);
const valuationPolishStylesPath = new URL('../app/valuation/valuation-flow-polish.module.css', import.meta.url);

const protectedAppLayoutPaths = [
  new URL('../app/dealer/layout.tsx', import.meta.url),
  new URL('../app/field-manager/layout.tsx', import.meta.url),
  new URL('../app/owner-app/layout.tsx', import.meta.url),
];

test('the normal website uses a device viewport with native zoom enabled', async () => {
  const [rootSource, homeSource] = await Promise.all([
    readFile(rootLayoutPath, 'utf8'),
    readFile(homePagePath, 'utf8'),
  ]);

  assert.match(rootSource, /export const viewport: Viewport\s*=\s*\{/);
  assert.match(rootSource, /width:\s*['"]device-width['"]/);
  assert.match(rootSource, /initialScale:\s*1/);
  assert.match(rootSource, /userScalable:\s*true/);
  assert.doesNotMatch(rootSource, /maximumScale|minimumScale/);
  assert.doesNotMatch(homeSource, /export const viewport|width:\s*980/);
});

test('the normal website renders immediately without an orientation gate', async () => {
  const rootSource = await readFile(rootLayoutPath, 'utf8');

  assert.match(rootSource, /<body>[\s\S]*?<div className="appRoot">/);
  assert.doesNotMatch(rootSource, /MobileOrientationPrompt/);
  assert.doesNotMatch(rootSource, /Turn your phone sideways|Rotate to landscape/);
});

test('the three role apps keep zoomable device-width viewports', async () => {
  for (const layoutPath of protectedAppLayoutPaths) {
    const source = await readFile(layoutPath, 'utf8');

    assert.match(source, /width:\s*['"]device-width['"]/);
    assert.match(source, /initialScale:\s*1/);
    assert.match(source, /userScalable:\s*true/);
    assert.doesNotMatch(source, /maximumScale|minimumScale/);
  }
});

test('the Home page no longer carries narrow-screen layout branches or copy', async () => {
  const [pageSource, styleSource] = await Promise.all([
    readFile(homePagePath, 'utf8'),
    readFile(homeStylesPath, 'utf8'),
  ]);

  assert.doesNotMatch(styleSource, /@media\s*\([^)]*max-width/);
  assert.match(styleSource, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(pageSource, /heroTextMobile|heroTextDesktop/);
});

test('the Home hero keeps reliable playback without a mobile-only video asset', async () => {
  const [videoSource, styleSource] = await Promise.all([
    readFile(homeVideoPath, 'utf8'),
    readFile(homeStylesPath, 'utf8'),
  ]);

  assert.match(videoSource, /src="\/brand\/AIM4PRICE\.mp4"/);
  assert.match(videoSource, /playsInline/);
  assert.doesNotMatch(videoSource, /AIM4PRICE-mobile\.mp4|media="\(max-width:/);
  assert.match(styleSource, /\.heroVideoPlay\s*\{[^}]*display:\s*inline-flex/s);
});

test('Get Estimate keeps the website viewport stable and presents family results as an accessible modal', async () => {
  const [pageSource, polishSource, polishStyles] = await Promise.all([
    readFile(valuationPagePath, 'utf8'),
    readFile(valuationPolishPath, 'utf8'),
    readFile(valuationPolishStylesPath, 'utf8'),
  ]);

  assert.match(pageSource, /<ValuationFlowPolish\s*\/>[\s\S]*?<ValuationClient\s*\/>/);
  assert.match(polishSource, /const WIZARD_CARD_ID = 'valuation-wizard-card'/);
  assert.match(polishSource, /originalScrollIntoView = wizard\.scrollIntoView;[\s\S]*?wizard\.scrollIntoView = \(\) => undefined/);
  assert.doesNotMatch(polishSource, /Element\.prototype\.scrollIntoView|HTMLElement\.prototype\.scrollIntoView/);
  assert.match(polishSource, /FAMILY_SEARCH_LABEL = \/\^Search \(equipment type\|vehicle type\)\$\/i/);
  assert.match(polishSource, /data-valuation-family-modal/);
  assert.match(polishSource, /setAttribute\('role', 'dialog'\)/);
  assert.match(polishSource, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(polishSource, /event\.key === 'Escape'/);
  assert.match(polishSource, /focus\(\{ preventScroll: true \}\)/);
  assert.match(polishStyles, /\.familyBackdrop\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;/);
  assert.match(polishStyles, /data-valuation-family-modal='true'[\s\S]*?position:\s*fixed\s*!important/);
  assert.match(polishStyles, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(polishStyles, /@media\s*\([^)]*(?:max-width|min-width|orientation)/);
});


test('operational viewports preserve their former inherited settings', async () => {
  for (const route of ['admin', 'scan', 'fuel-scan']) {
    const source = await readFile(new URL('../app/' + route + '/layout.tsx', import.meta.url), 'utf8');
    assert.match(source, /width: 980/);
    assert.match(source, /initialScale: -1/);
    assert.match(source, /userScalable: true/);
  }
});
