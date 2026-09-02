import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootLayoutPath = new URL('../app/layout.tsx', import.meta.url);
const homePagePath = new URL('../app/page.tsx', import.meta.url);
const homeHeroPath = new URL('../app/home-hero-experience.tsx', import.meta.url);
const homeStylesPath = new URL('../app/page.module.css', import.meta.url);
const homeVideoPath = new URL('../app/home-hero-video.tsx', import.meta.url);

const protectedAppLayoutPaths = [
  new URL('../app/dealer/layout.tsx', import.meta.url),
  new URL('../app/field-manager/layout.tsx', import.meta.url),
  new URL('../app/owner-app/layout.tsx', import.meta.url),
];

test('the normal website uses the physical device viewport without disabling zoom', async () => {
  const [rootSource, homeSource] = await Promise.all([
    readFile(rootLayoutPath, 'utf8'),
    readFile(homePagePath, 'utf8'),
  ]);

  assert.match(rootSource, /export const viewport: Viewport\s*=\s*\{/);
  assert.match(rootSource, /width:\s*['"]device-width['"]/);
  assert.match(rootSource, /initialScale:\s*1/);
  assert.match(rootSource, /userScalable:\s*true/);
  assert.match(rootSource, /viewportFit:\s*['"]cover['"]/);
  assert.doesNotMatch(rootSource, /width:\s*980|initialScale:\s*-1/);
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

test('the Home hero enhances capable desktops and stays in normal flow elsewhere', async () => {
  const [heroSource, styleSource] = await Promise.all([
    readFile(homeHeroPath, 'utf8'),
    readFile(homeStylesPath, 'utf8'),
  ]);

  assert.match(
    heroSource,
    /\(min-width: 1181px\) and \(min-height: 700px\) and \(hover: hover\) and \(pointer: fine\)/,
  );
  assert.match(heroSource, /data-story-capability={isCinematicStory \? 'cinematic' : 'static'}/);
  assert.match(
    styleSource,
    /@media \(min-width: 1181px\) and \(min-height: 700px\) and \(hover: hover\) and \(pointer: fine\)[\s\S]*?min-height: 500svh[\s\S]*?position: sticky/,
  );
  assert.match(
    styleSource,
    /\.assetStageMotion \.assetHeroStage \{[\s\S]*?display: grid;[\s\S]*?aspect-ratio: auto/,
  );
  assert.match(
    styleSource,
    /@media \(max-width: 760px\)[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.doesNotMatch(styleSource, /\bzoom\s*:|min-width:\s*(?:1360px|85rem)|--asset-stage-shift-x/);
  assert.doesNotMatch(heroSource, /offsetLeft|preventDefault\(\)[\s\S]*?(?:wheel|touchmove)/);
});

test('Home does not require a fitment gate or a device-specific video to render', async () => {
  const [homeSource, heroSource, styleSource] = await Promise.all([
    readFile(homePagePath, 'utf8'),
    readFile(homeHeroPath, 'utf8'),
    readFile(homeStylesPath, 'utf8'),
  ]);

  assert.doesNotMatch(homeSource, /HomeDisplayCheck|standardCanvas/);
  assert.doesNotMatch(heroSource, /useHomeDisplay|displayReady|displayScale/);
  assert.doesNotMatch(styleSource, /homeContent|aim4price-site-scale/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styleSource, /@media \(forced-colors: active\)/);
});
