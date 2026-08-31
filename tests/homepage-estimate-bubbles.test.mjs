import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage presents four green Get Estimate video bubbles', async () => {
  const [page, bubbles, styles, headerStyles] = await Promise.all([
    read('app/page.tsx'),
    read('app/home-estimate-bubbles.tsx'),
    read('app/page.module.css'),
    read('components/AppHeader.module.css'),
  ]);

  assert.match(page, /<span>Track the finer details\.<\/span>/);
  assert.match(page, /import HomeEstimateBubbles from '\.\/home-estimate-bubbles'/);
  assert.match(page, /<HomeEstimateBubbles \/>/);

  const videoSources = bubbles.match(/\/brand\/valuation\/(?:Agriculture|Construction|Industrial|Motor)\.mp4/g) ?? [];
  assert.deepEqual(videoSources, [
    '/brand/valuation/Agriculture.mp4',
    '/brand/valuation/Construction.mp4',
    '/brand/valuation/Industrial.mp4',
    '/brand/valuation/Motor.mp4',
  ]);
  assert.equal((bubbles.match(/positionClass: styles\.heroBubble/g) ?? []).length, 4);
  assert.match(bubbles, /preload="metadata"/);
  assert.match(bubbles, /muted[\s\S]*?loop[\s\S]*?playsInline/);
  assert.doesNotMatch(bubbles, /autoPlay/);
  assert.match(bubbles, /onMouseEnter=[\s\S]*?onMouseLeave=[\s\S]*?onFocus=[\s\S]*?onBlur=/);
  assert.match(bubbles, /prefers-reduced-motion: reduce/);
  assert.match(bubbles, /\(any-hover: hover\)/);
  assert.match(bubbles, /previewRequestSequence/);
  assert.match(bubbles, /resetSiblingPreviews/);
  assert.match(bubbles, /:focus-visible/);
  assert.match(bubbles, /href="\/valuation"/);

  assert.match(styles, /Four interactive Get Estimate video bubbles/);
  assert.match(styles, /\.heroBubbleSurface \{[\s\S]*?linear-gradient\(145deg, #31b88a 0%, #208f6b 48%, #126149 100%\)/);
  assert.match(styles, /\.heroBubble\[data-preview-active='true'\] \.heroBubbleVideo \{[\s\S]*?opacity: 1/);
  assert.match(styles, /opacity 120ms ease,[\s\S]*?transform 480ms ease,[\s\S]*?filter 160ms ease/);
  assert.match(styles, /\.heroBubbleSurface \{[\s\S]*?transition: opacity 120ms ease/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.heroBubbleTouchLabel \{[\s\S]*?display: none/);
  assert.match(styles, /@media \(any-hover: none\)[\s\S]*?\.heroBubbleTouchLabel \{[\s\S]*?display: flex/);
  assert.match(styles, /\.heroBubble:focus-visible \{[\s\S]*?outline: 3px solid #14684f/);
  assert.match(headerStyles, /@media \(min-width: 1181px\) and \(max-width: 1240px\)[\s\S]*?translateX\(clamp\(8px, calc\(\(100vw - 1212px\) \/ 2\), 14px\)\)/);
  assert.match(headerStyles, /@media \(min-width: 1241px\)[\s\S]*?translateX\(clamp\(0px, calc\(\(100vw - 1228px\) \/ 2\), 90px\)\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
});
