import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootLayoutPath = new URL('../app/layout.tsx', import.meta.url);
const homePagePath = new URL('../app/page.tsx', import.meta.url);
const homeStylesPath = new URL('../app/page.module.css', import.meta.url);
const homeVideoPath = new URL('../app/home-hero-video.tsx', import.meta.url);

const protectedAppLayoutPaths = [
  new URL('../app/dealer/layout.tsx', import.meta.url),
  new URL('../app/field-manager/layout.tsx', import.meta.url),
  new URL('../app/owner-app/layout.tsx', import.meta.url),
];

test('the normal website inherits an auto-fitted desktop viewport from the shared root', async () => {
  const [rootSource, homeSource] = await Promise.all([
    readFile(rootLayoutPath, 'utf8'),
    readFile(homePagePath, 'utf8'),
  ]);

  assert.match(rootSource, /export const viewport: Viewport\s*=\s*\{/);
  assert.match(rootSource, /width:\s*980/);
  assert.match(rootSource, /initialScale:\s*-1/);
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
