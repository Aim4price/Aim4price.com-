import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the compact display check is homepage-only and leaves touch devices and apps alone', async () => {
  const [page, check, checkStyles, header, headerStyles] = await Promise.all([
    read('app/page.tsx'),
    read('app/home-display-check.tsx'),
    read('app/home-display-check.module.css'),
    read('components/AppHeader.tsx'),
    read('components/AppHeader.module.css'),
  ]);

  assert.match(page, /import HomeDisplayCheck from '\.\/home-display-check'/);
  assert.match(
    page,
    /<HomeDisplayCheck>[\s\S]*?<AppHeader[\s\S]*?<HomeHeroExperience \/>[\s\S]*?<HomeRoleSelector \/>[\s\S]*?<\/HomeDisplayCheck>/,
  );
  assert.match(
    check,
    /DISPLAY_CHECK_QUERY =[\s\S]*?min-width: 1181px[\s\S]*?min-height: 640px[\s\S]*?hover: hover[\s\S]*?pointer: fine/,
  );
  assert.match(
    check,
    /if \(!desktopMedia\.matches\)[\s\S]*?setIsGateOpen\(false\)[\s\S]*?setIsDisplayReady\(true\)/,
  );
  assert.match(checkStyles, /\.dialog \{[\s\S]*?width: min\(100%, 32\.5rem\)[\s\S]*?max-height: calc\(100dvh - 2rem\)[\s\S]*?overflow: hidden/);
  assert.doesNotMatch(header, /homeDensity/);
  assert.doesNotMatch(header, /HomeDisplayCheck|home-display-check/);
  assert.doesNotMatch(headerStyles, /homeDensity/);
});

test('the check keeps security language truthful and deliberately small', async () => {
  const check = await read('app/home-display-check.tsx');

  assert.match(check, /window\.location\.protocol === 'https:' && window\.isSecureContext/);
  assert.match(check, /'localhost', '127\.0\.0\.1', '::1'/);
  assert.match(check, /Quick display check/);
  assert.match(check, /Use − or \+ until the card sits inside the frame\./);
  assert.match(check, /Secure connection/);
  assert.match(check, /Secure connection required/);
  assert.match(check, /Open secure Aim4price/);
  assert.match(check, /Saved in this browser\./);
  assert.doesNotMatch(check, /security &amp; display check|protected setup|inspect personal files/);
});

test('the preview is measured on both axes before Continue unlocks', async () => {
  const [check, styles] = await Promise.all([
    read('app/home-display-check.tsx'),
    read('app/home-display-check.module.css'),
  ]);

  assert.match(check, /getBoundingClientRect\(\)/);
  assert.match(check, /const safeInset = 6/);
  assert.match(check, /preview\.left >= frame\.left \+ safeInset/);
  assert.match(check, /preview\.top >= frame\.top \+ safeInset/);
  assert.match(check, /preview\.right <= frame\.right - safeInset/);
  assert.match(check, /preview\.bottom <= frame\.bottom - safeInset/);
  assert.match(check, /new ResizeObserver\(scheduleFitMeasurement\)/);
  assert.match(check, /id: 'compact', label: 'Compact', scale: 0\.78/);
  assert.match(check, /id: 'original', label: 'Original', scale: 1/);
  assert.match(check, /ratios\.width <= PREVIEW_SAFE_WIDTH_RATIO/);
  assert.match(check, /ratios\.height <= PREVIEW_SAFE_HEIGHT_RATIO/);
  assert.match(check, /Math\.min\(current, recommendedIndex\)/);
  assert.match(check, /aria-label="Make Aim4price smaller"/);
  assert.match(check, /aria-label="Make Aim4price larger"/);
  assert.match(check, /disabled=\{!isSecure \|\| !doesPreviewFit\}/);
  assert.match(styles, /\.sizeControls > button \{[\s\S]*?min-height: 2\.75rem/);
});

test('original preserves #543 and compact is an explicit homepage-only choice', async () => {
  const [check, pageStyles, headerStyles] = await Promise.all([
    read('app/home-display-check.tsx'),
    read('app/page.module.css'),
    read('components/AppHeader.module.css'),
  ]);

  assert.match(check, /DISPLAY_STORAGE_KEY = 'aim4price:home-display-check:v2'/);
  assert.match(check, /DISPLAY_STORAGE_VERSION = 2/);
  assert.match(check, /window\.localStorage\.getItem/);
  assert.match(check, /window\.localStorage\.setItem/);
  assert.match(check, /viewportClass/);
  assert.match(check, /data-home-display-size=\{size\.id\}/);
  assert.match(pageStyles, /The #543 desktop composition is the default/);
  assert.match(pageStyles, /\.page\[data-home-display-size='compact'\]/);
  assert.doesNotMatch(pageStyles, /data-home-display-size='original'/);
  assert.doesNotMatch(pageStyles, /home-density-/);
  assert.match(headerStyles, /:global\(\[data-home-display-size='compact'\]\) \.inner/);
  assert.doesNotMatch(headerStyles, /data-home-display-size='original'/);

  const combined = [check, pageStyles, headerStyles].join('\n');
  assert.doesNotMatch(combined, /devicePixelRatio|visualViewport|outerWidth|screen\.width/);
  assert.doesNotMatch(combined, /\bzoom\s*:/);
  assert.doesNotMatch(combined, /transform:\s*scale\(0\./);
});

test('the modal isolates focus and pauses the hero story until it closes', async () => {
  const [check, styles, hero] = await Promise.all([
    read('app/home-display-check.tsx'),
    read('app/home-display-check.module.css'),
    read('app/home-hero-experience.tsx'),
  ]);

  assert.match(check, /role="dialog"/);
  assert.match(check, /aria-modal="true"/);
  assert.match(check, /aria-labelledby="home-display-check-title"/);
  assert.match(check, /aria-describedby="home-display-check-description"/);
  assert.match(check, /aria-live="polite"/);
  assert.match(check, /content\.setAttribute\('inert', ''\)/);
  assert.match(check, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(check, /if \(event\.key === 'Escape'\)[\s\S]*?useRecommendedSize\(\)/);
  assert.match(check, /event\.key !== 'Tab'/);
  assert.match(check, /dialogRef\.current\?\.focus\(\)/);
  assert.match(check, /document\.getElementById\('home-hero-title'\)\?\.focus\(\)/);

  assert.match(hero, /useHomeDisplayReady\(\)/);
  assert.match(hero, /!isHomeDisplayReady/);
  assert.match(hero, /if \(!isCinematicStory \|\| !isHomeDisplayReady\) return undefined/);
  assert.match(hero, /id="home-hero-title"[\s\S]*?tabIndex=\{-1\}/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
});
