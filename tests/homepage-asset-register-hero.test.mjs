import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Home keeps the requested eight-step story and hands off to role selection', async () => {
  const [page, hero, roleSelector] = await Promise.all([
    read('app/page.tsx'),
    read('app/home-hero-experience.tsx'),
    read('app/home-role-selector.tsx'),
  ]);

  assert.match(page, /<div className={styles\.page}>[\s\S]*?<AppHeader active="home" \/>[\s\S]*?<main className={styles\.homeMain}>/);
  assert.ok(page.indexOf('<AppHeader active="home" />') < page.indexOf('<main className={styles.homeMain}>'));
  assert.ok(page.indexOf('<HomeHeroExperience />') < page.indexOf('<HomeRoleSelector />'));
  assert.doesNotMatch(page, /HomeDisplayCheck|standardCanvas/);

  const featureSteps = hero.slice(
    hero.indexOf('export const HERO_STAGES'),
    hero.indexOf('export const HERO_STORY_STEPS'),
  );
  assert.deepEqual(
    [...featureSteps.matchAll(/^\s+'([^']+)',?$/gm)].map((match) => match[1]),
    ['have', 'worth', 'cost', 'manage', 'attention'],
  );

  const openingSteps = hero.slice(
    hero.indexOf('export const HERO_STORY_STEPS'),
    hero.indexOf('type StoryStep'),
  );
  assert.deepEqual(
    [...openingSteps.matchAll(/^\s+'([^']+)',?$/gm)].map((match) => match[1]),
    ['brand', 'promise', 'preview'],
  );
  assert.match(openingSteps, /\.\.\.HERO_STAGES/);

  assert.match(hero, /Aim4price\.com asset management software built for South Africa/);
  assert.match(hero, /<span>Aim4price\.com<\/span>/);
  assert.match(hero, /<span>Asset Management Software<\/span>/);
  assert.match(hero, /<span>built for South Africa\.<\/span>/);
  assert.match(hero, /Know what you have\./);
  assert.match(hero, /Know what it’s worth\./);
  assert.match(hero, /Know what it really costs\./);
  assert.match(hero, /One complete record for every asset\./);
  assert.match(hero, /Understand what it’s worth\./);
  assert.match(hero, /See what it really costs\./);
  assert.match(hero, /Manage its entire working life\./);
  assert.match(hero, /Bring the next action forward\./);

  assert.match(hero, /href="#choose-role"[\s\S]*?See Aim4price in Action/);
  assert.match(hero, /href="\/valuation"[\s\S]*?Get a Free Estimate/);
  assert.match(hero, /<section[\s\S]*?aria-labelledby="home-hero-title"/);
  assert.match(hero, /<h1 id="home-hero-title"[\s\S]*?tabIndex={-1}/);
  assert.match(hero, /className={styles\.storyHeroLogo}[\s\S]*?aria-hidden="true"[\s\S]*?alt=""/);
  assert.match(hero, /className={styles\.storyPauseControl}[\s\S]*?aria-pressed={isPaused}/);
  assert.match(hero, /className={styles\.featureNarrativeLayer}[\s\S]*?data-active={isActive \? 'true' : 'false'}/);
  assert.doesNotMatch(hero, /aria-hidden={storyStepIndex|aria-hidden={!isActive/);
  assert.match(roleSelector, /id="choose-role"/);
  assert.match(roleSelector, /aria-labelledby="choose-role-title"/);
  assert.match(roleSelector, /id="choose-role-title"[\s\S]*?tabIndex={-1}/);
  assert.match(roleSelector, /focus\(\{ preventScroll: true \}\)/);
  assert.match(roleSelector, /Which describes you best\?/);
  assert.match(roleSelector, /I own or manage assets/);
  assert.match(roleSelector, /I sell, service or support assets/);
});

test('the five asset previews keep their complete product content and accessible controls', async () => {
  const preview = await read('app/home-asset-preview.tsx');

  for (const key of ['have', 'worth', 'cost', 'manage', 'attention']) {
    assert.match(preview, new RegExp("key: '" + key + "'"));
  }
  for (const label of [
    'Know what you have',
    'Know what it’s worth',
    'Know what it really costs',
    'Manage its working life',
    'See what needs attention',
  ]) {
    assert.ok(preview.includes("label: '" + label + "'"));
  }

  assert.match(preview, /role="tablist"/);
  assert.match(preview, /role="tab"/);
  assert.match(preview, /aria-selected={isActive}/);
  assert.match(preview, /aria-label="Explore the Aim4price asset record"/);
  assert.match(preview, /aria-controls="home-asset-preview"/);
  assert.match(preview, /tabIndex={isActive \? 0 : -1}/);
  assert.match(preview, /event\.key === 'ArrowRight' \|\| event\.key === 'ArrowDown'/);
  assert.match(preview, /event\.key === 'ArrowLeft' \|\| event\.key === 'ArrowUp'/);
  assert.match(preview, /event\.key === 'Home'/);
  assert.match(preview, /event\.key === 'End'/);
  assert.match(preview, /role="tabpanel"/);
  assert.match(preview, /role="status"[\s\S]*?aria-live="polite"/);
  assert.match(preview, /className={styles\.assetHeroStage}[\s\S]*?onPointerEnter=\{\(\) => onInteraction\?\.\('pointer-enter'\)\}[\s\S]*?onPointerLeave=\{\(\) => onInteraction\?\.\('pointer-leave'\)\}/);

  assert.match(preview, /2023 Toyota Hilux Single Cab/);
  assert.match(preview, /R 237 150/);
  assert.match(preview, /R 450 000/);
  assert.match(preview, /home-asset-hilux-listing\.webp/);
  assert.match(preview, /\(min-width: 1600px\) 430px[\s\S]*?\(min-width: 761px\) 48vw/);
  assert.match(preview, /Asset Valuation Report preview/);
  assert.match(preview, /Create Ad/);
  assert.match(preview, /Save to Asset Register/);
  assert.match(preview, /Download PDF/);

  for (const action of [
    'Update asset',
    'Reports',
    'Add cost',
    'Add fuel',
    'Maintenance',
    'Asset map',
    'QR code',
    'Marketplace',
    'Remove asset',
  ]) {
    assert.match(preview, new RegExp(action));
  }

  assert.match(preview, /Download maintenance report/);
  assert.match(preview, /Download fuel report/);
  assert.match(preview, /Download depreciation log/);
  assert.match(preview, /Download cost of ownership report/);
  assert.match(preview, /Open issue reported/);
  assert.match(preview, /Maintenance has been done/);
});

test('Home geometry is owned by responsive grid tracks, never browser-scale calibration', async () => {
  const [hero, styles, header, headerStyles] = await Promise.all([
    read('app/home-hero-experience.tsx'),
    read('app/page.module.css'),
    read('components/AppHeader.tsx'),
    read('components/AppHeader.module.css'),
  ]);

  assert.match(styles, /--home-shell-max: var\(--site-wide-shell-max, 1360px\)/);
  assert.match(styles, /\.shell \{[\s\S]*?calc\(100% - \(var\(--home-gutter\) \* 2\)\)[\s\S]*?var\(--home-shell-max\)/);
  assert.match(styles, /@media \(min-width: 960px\)[\s\S]*?\.assetStageMotion \{[\s\S]*?grid-column: 1;[\s\S]*?\.featureNarrative \{[\s\S]*?grid-column: 2/);
  assert.match(styles, /data-story-mode='features'[\s\S]*?\.storyHeroGrid \{[\s\S]*?grid-template-columns: minmax\(34rem, 1\.16fr\) minmax\(22rem, 0\.84fr\)/);
  assert.match(styles, /data-story-capability='cinematic'[\s\S]*?\.assetStageMotion \{[\s\S]*?grid-column: 1 \/ -1/);
  assert.match(styles, /data-story-capability='cinematic'[\s\S]*?\.assetHeroStage \{[\s\S]*?left: calc\(100% - min\(55%, 49\.5rem\)\)[\s\S]*?transition: left 900ms/);
  assert.match(styles, /data-story-mode='features'[\s\S]*?\.assetHeroStage \{[\s\S]*?left: 0/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.compactHeroActions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*?\.compactHeroActions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);

  assert.doesNotMatch(styles, /\bzoom\s*:|min-width:\s*(?:1360px|85rem)|--asset-stage-shift-x/);
  assert.doesNotMatch(styles, /inset-inline-start:\s*calc\(0rem -|width:\s*min\([^;]*calc\(100% \+/);
  assert.doesNotMatch(hero, /offsetLeft|storyGridRef|assetMotionRef|useHomeDisplay|HomeDisplay/);
  assert.doesNotMatch(hero, /previousElementSibling|ResizeObserver/);
  assert.match(hero, /data-story-opening/);
  assert.match(hero, /data-story-preview/);
  assert.match(hero, /data-story-narrative/);
  assert.doesNotMatch(header, /standardCanvas|HomeDisplay/);
  assert.doesNotMatch(header, /brandAlignment|brandWorkingColumn/);
  assert.doesNotMatch(headerStyles, /headerStandardCanvas|standardCanvas|brandWorkingColumn/);

  assert.match(hero, /\(min-width: 1181px\) and \(min-height: 700px\) and \(hover: hover\) and \(pointer: fine\)/);
  assert.match(styles, /@media \(min-width: 1181px\) and \(min-height: 700px\) and \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\)/);
  assert.match(styles, /@media \(min-width: 761px\) and \(max-width: 959px\)/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /@media \(max-width: 360px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
});

test('Home preview assets remain present and appropriately compressed', async () => {
  const images = await Promise.all(
    [
      'home-asset-hilux-listing.webp',
      'home-asset-hilux-thumb-side.webp',
      'home-asset-hilux-thumb-rear.webp',
      'home-asset-hilux-thumb-alt.webp',
    ].map((filename) => stat(new URL('../public/brand/' + filename, import.meta.url))),
  );

  assert.ok(images[0].size > 0 && images[0].size < 150_000);
  assert.ok(images.slice(1).every(({ size }) => size > 0 && size < 50_000));
});

test('retired fitment artifacts cannot be reintroduced accidentally', async () => {
  for (const path of [
    'app/home-display-check.tsx',
    'app/home-display-check.module.css',
    'tests/homepage-display-security-check.test.mjs',
  ]) {
    await assert.rejects(stat(new URL(`../${path}`, import.meta.url)), { code: 'ENOENT' });
  }
});
