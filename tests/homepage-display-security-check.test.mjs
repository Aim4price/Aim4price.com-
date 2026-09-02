import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the desktop homepage owns the security and display check without changing role apps', async () => {
  const [page, check, checkStyles, hero, pageStyles, header, headerStyles] =
    await Promise.all([
      read('app/page.tsx'),
      read('app/home-display-check.tsx'),
      read('app/home-display-check.module.css'),
      read('app/home-hero-experience.tsx'),
      read('app/page.module.css'),
      read('components/AppHeader.tsx'),
      read('components/AppHeader.module.css'),
    ]);

  assert.match(page, /import HomeDisplayCheck from '\.\/home-display-check'/);
  assert.match(
    page,
    /<HomeDisplayCheck>[\s\S]*?<AppHeader[\s\S]*?<HomeHeroExperience \/>[\s\S]*?<HomeRoleSelector \/>[\s\S]*?<\/HomeDisplayCheck>/,
  );
  assert.doesNotMatch(page, /<main className=/);

  assert.match(check, /^'use client';/);
  assert.match(
    check,
    /DISPLAY_CHECK_QUERY =[\s\S]*?min-width: 1181px[\s\S]*?min-height: 640px[\s\S]*?hover: hover[\s\S]*?pointer: fine/,
  );
  assert.match(check, /if \(!desktopMedia\.matches\)[\s\S]*?setIsGateOpen\(false\)[\s\S]*?setIsDisplayReady\(true\)/);
  assert.match(header, /pathname === '\/' \? styles\.homeDensity : ''/);
  assert.doesNotMatch(header, /HomeDisplayCheck|home-display-check/);

  const combined = [check, checkStyles, hero, pageStyles, headerStyles].join('\n');
  assert.doesNotMatch(combined, /devicePixelRatio|visualViewport|outerWidth|screen\.width/);
  assert.doesNotMatch(combined, /\bzoom\s*:/);
  assert.doesNotMatch(checkStyles, /\.displayRoot[^}]*transform\s*:/s);
});

test('security language is backed by HTTPS secure-context state and keeps local development distinct', async () => {
  const check = await read('app/home-display-check.tsx');

  assert.match(
    check,
    /window\.location\.protocol === 'https:' && window\.isSecureContext/,
  );
  assert.match(check, /'localhost', '127\.0\.0\.1', '::1'/);
  assert.match(check, /type SecurityStatus = 'checking' \| 'protected' \| 'local-development' \| 'insecure'/);
  assert.match(check, /Connection protected/);
  assert.match(check, /This page is using HTTPS in a protected browser context\./);
  assert.match(check, /Local development context/);
  assert.match(check, /Production still requires HTTPS\./);
  assert.match(check, /Open Aim4price over HTTPS to continue\./);
  assert.match(check, /This check does not[\s\S]*?inspect personal files or identify your device/);
  assert.match(check, /const canContinue = securityPassed && doesPreviewFit/);
  assert.match(check, /disabled=\{!canContinue\}/);
});

test('display fit is measured on both axes before Continue unlocks', async () => {
  const [check, styles] = await Promise.all([
    read('app/home-display-check.tsx'),
    read('app/home-display-check.module.css'),
  ]);

  assert.match(check, /getBoundingClientRect\(\)/);
  assert.match(check, /const safeInset = 8/);
  assert.match(check, /preview\.left >= frame\.left \+ safeInset/);
  assert.match(check, /preview\.top >= frame\.top \+ safeInset/);
  assert.match(check, /preview\.right <= frame\.right - safeInset/);
  assert.match(check, /preview\.bottom <= frame\.bottom - safeInset/);
  assert.match(check, /preview\.width <= frame\.width - safeInset \* 2/);
  assert.match(check, /preview\.height <= frame\.height - safeInset \* 2/);
  assert.match(check, /new ResizeObserver\(scheduleFitMeasurement\)/);
  assert.match(check, /window\.requestAnimationFrame\(scheduleFitMeasurement\)/);

  assert.match(check, /id: 'compact', label: 'Compact', fitScale: 0\.58/);
  assert.match(check, /id: 'balanced', label: 'Balanced', fitScale: 0\.88/);
  assert.match(check, /id: 'spacious', label: 'Spacious', fitScale: 1\.08/);
  assert.match(check, /aria-label="Make display smaller"/);
  assert.match(check, /aria-label="Make display larger"/);
  assert.match(check, /Use recommended size/);
  assert.match(check, /Continue to Aim4price/);
  assert.match(styles, /\.densityButton[\s\S]*?min-height: var\(--tap-target-min, 44px\)/);
});

test('the accepted density controls bounded homepage tokens and persists without repeated resize gates', async () => {
  const [check, checkStyles, pageStyles, headerStyles] = await Promise.all([
    read('app/home-display-check.tsx'),
    read('app/home-display-check.module.css'),
    read('app/page.module.css'),
    read('components/AppHeader.module.css'),
  ]);

  assert.match(check, /DISPLAY_STORAGE_KEY = 'aim4price:home-display-check:v1'/);
  assert.match(check, /DISPLAY_STORAGE_VERSION = 1/);
  assert.match(check, /window\.localStorage\.getItem/);
  assert.match(check, /window\.localStorage\.setItem/);
  assert.match(check, /try \{[\s\S]*?localStorage[\s\S]*?\} catch \{/);
  assert.match(check, /viewportSignature/);
  assert.match(
    check,
    /if \(isDisplayReady && acceptedViewportRef\.current\)[\s\S]*?Math\.min\(densityIndex, recommendedIndex\)[\s\S]*?writeStoredDisplayCheck/,
  );

  assert.match(check, /data-home-display-density=\{density\.id\}/);
  for (const density of ['compact', 'balanced', 'spacious']) {
    assert.match(checkStyles, new RegExp(`data-home-display-density='${density}'`));
  }
  assert.match(pageStyles, /\.page\[data-home-display-density\][\s\S]*?--home-density-shell-max/);
  assert.match(pageStyles, /\.page\[data-home-display-density\][\s\S]*?--home-density-brand-primary/);
  assert.match(pageStyles, /\.page\[data-home-display-density\][\s\S]*?--home-density-asset-width/);
  assert.match(pageStyles, /\.page\[data-home-display-density\][\s\S]*?--home-density-role-title/);
  assert.match(headerStyles, /:global\(\[data-home-display-density\]\) \.homeDensity \.inner/);
  assert.match(headerStyles, /--home-density-header-height/);
  assert.match(headerStyles, /--tap-target-min, 44px/);
});

test('the modal isolates focus and pauses the hero story until the check completes', async () => {
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
  assert.match(check, /aria-atomic="true"/);
  assert.match(check, /sibling\.setAttribute\('inert', ''\)/);
  assert.match(check, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(check, /if \(event\.key === 'Escape'\)/);
  assert.match(check, /event\.key !== 'Tab'/);
  assert.match(check, /dialogRef\.current\?\.focus\(\)/);
  assert.match(check, /document\.getElementById\('home-hero-title'\)\?\.focus\(\)/);
  assert.match(check, /aria-hidden="true"[\s\S]*?className=\{styles\.previewTopline\}/);

  assert.match(hero, /useHomeDisplayReady\(\)/);
  assert.match(hero, /!isHomeDisplayReady/);
  assert.match(hero, /if \(!isCinematicStory \|\| !isHomeDisplayReady\) return undefined/);
  assert.match(hero, /id="home-hero-title"[\s\S]*?tabIndex=\{-1\}/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
});
