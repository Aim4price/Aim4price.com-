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

test('the Home hero has cinematic desktop, static-wide and phone contracts', async () => {
  const [heroSource, styleSource] = await Promise.all([
    readFile(homeHeroPath, 'utf8'),
    readFile(homeStylesPath, 'utf8'),
  ]);

  const storyStart = styleSource.indexOf(
    '/* === Timed and scroll-led Aim4price homepage story, September 2026 === */',
  );
  assert.ok(storyStart >= 0);
  const storyStyles = styleSource.slice(storyStart);

  assert.match(heroSource, /CINEMATIC_STORY_QUERY = '\(min-width: 1181px\) and \(min-height: 640px\)'/);
  assert.match(heroSource, /data-story-capability=\{isCinematicStory \? 'cinematic' : 'static'\}/);
  assert.match(storyStyles, /@media \(min-width: 1181px\) and \(min-height: 640px\)[\s\S]*?min-height: 440svh[\s\S]*?position: sticky/);
  assert.match(storyStyles, /@media \(max-width: 1180px\), \(max-height: 639px\), \(prefers-reduced-motion: reduce\)[\s\S]*?position: relative[\s\S]*?transform: none !important/);
  assert.match(storyStyles, /@media \(max-width: 760px\)[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(storyStyles, /@media \(max-width: 760px\)[\s\S]*?\.heroBrandTitle span \{[\s\S]*?white-space: normal/);
  assert.doesNotMatch(storyStyles, /@media \(min-width: 901px\) and \(max-width: 1180px\)/);
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
