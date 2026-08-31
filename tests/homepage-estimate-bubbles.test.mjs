import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage presents four green Get Estimate video bubbles', async () => {
  const [page, bubbles, styles, appHeader, headerStyles, assetRegister, registerGateway] = await Promise.all([
    read('app/page.tsx'),
    read('app/home-estimate-bubbles.tsx'),
    read('app/page.module.css'),
    read('components/AppHeader.tsx'),
    read('components/AppHeader.module.css'),
    read('app/asset-register/asset-register-client.tsx'),
    read('app/asset-register/dealer-register-gateway.tsx'),
  ]);

  assert.match(page, /<span>Track the finer details\.<\/span>/);
  assert.match(page, /import HomeEstimateBubbles from '\.\/home-estimate-bubbles'/);
  assert.match(page, /<HomeEstimateBubbles \/>/);
  assert.match(page, /<AppHeader active="home" brandAlignment="working-column" \/>/);
  assert.doesNotMatch(page, /Get free estimate|Create Asset Register/i);
  assert.doesNotMatch(page, /styles\.heroActions|styles\.primaryCta|styles\.secondaryCta/);
  assert.doesNotMatch(page, /from 'next\/link'/);
  assert.doesNotMatch(styles, /\.heroActions|\.primaryCta|\.secondaryCta/);
  assert.match(assetRegister, /<AppHeader active="asset-register" brandAlignment="working-column" \/>/);
  assert.match(registerGateway, /<AppHeader active="asset-register" brandAlignment="working-column" \/>/);

  const videoSources = bubbles.match(/\/brand\/valuation\/previews\/(?:agriculture|construction|industrial|motor)-home-preview\.mp4/g) ?? [];
  assert.deepEqual(videoSources, [
    '/brand/valuation/previews/agriculture-home-preview.mp4',
    '/brand/valuation/previews/construction-home-preview.mp4',
    '/brand/valuation/previews/industrial-home-preview.mp4',
    '/brand/valuation/previews/motor-home-preview.mp4',
  ]);
  const previewStats = await Promise.all(
    videoSources.map((source) => stat(new URL(`../public${source}`, import.meta.url))),
  );
  assert.ok(previewStats.every(({ size }) => size < 750_000));
  assert.ok(previewStats.reduce((total, { size }) => total + size, 0) < 2_000_000);
  assert.equal((bubbles.match(/positionClass: styles\.heroBubble/g) ?? []).length, 4);
  assert.doesNotMatch(bubbles, /\/brand\/valuation\/(?:Agriculture|Construction|Industrial|Motor)\.mp4/);
  assert.match(bubbles, /preload="none"/);
  assert.match(bubbles, /connection\?\.saveData/);
  assert.match(bubbles, /video\.preload = 'auto';[\s\S]*?video\.load\(\)/);
  assert.match(bubbles, /video\.dataset\.previewRequestId \|\| !video\.paused/);
  assert.match(bubbles, /const cleanup = \(\) => \{[\s\S]*?delete anchor\.dataset\.previewActive[\s\S]*?resetVideo\(video\)[\s\S]*?video\.preload = 'none';[\s\S]*?video\.load\(\)/);
  assert.equal((bubbles.match(/return cleanup;/g) ?? []).length, 2);
  assert.match(bubbles, /ref=\{groupRef\}/);
  assert.match(bubbles, /muted[\s\S]*?loop[\s\S]*?playsInline/);
  assert.doesNotMatch(bubbles, /autoPlay/);
  assert.match(bubbles, /onPointerEnter=[\s\S]*?onPointerMove=[\s\S]*?onPointerLeave=[\s\S]*?onFocus=[\s\S]*?onBlur=/);
  assert.match(bubbles, /event\.pointerType !== 'touch'/);
  assert.match(bubbles, /anchor\.dataset\.previewActive = 'true';[\s\S]*?video[\s\S]*?\.play\(\)/);
  assert.match(bubbles, /onPointerLeave=\{\(event\) => resetBubblePreview\(event\.currentTarget, false\)\}/);
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
  assert.match(styles, /\.heroBubbleVideo,[\s\S]*?\.heroBubbleSurface,[\s\S]*?\.heroBubbleTouchLabel \{[\s\S]*?pointer-events: none/);
  assert.match(styles, /\.heroBubbleAgriculture \{[\s\S]*?left: 0/);
  assert.match(styles, /\.heroBubbleIndustrial \{[\s\S]*?left: 6%/);
  assert.match(styles, /\.heroBubbleConstruction \{[\s\S]*?right: 1%/);
  assert.match(styles, /\.heroBubbleMotor \{[\s\S]*?right: 0/);
  assert.match(styles, /@media \(min-width: 1181px\)[\s\S]*?width: clamp\(22rem, 29vw, 34rem\)/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.heroBubbleTouchLabel \{[\s\S]*?display: none/);
  assert.match(styles, /@media \(any-hover: none\)[\s\S]*?\.heroBubbleTouchLabel \{[\s\S]*?display: flex/);
  assert.match(styles, /\.heroBubble:focus-visible \{[\s\S]*?outline: 3px solid #14684f/);
  assert.match(appHeader, /type BrandAlignment = 'header' \| 'working-column'/);
  assert.match(appHeader, /brandAlignment = 'header'/);
  assert.match(appHeader, /brandAlignment === 'working-column' \? styles\.brandWorkingColumn : ''/);
  assert.match(appHeader, /brandAlignmentClass \? styles\.innerBrandAligned/);
  assert.match(headerStyles, /@media \(min-width: 1181px\)[\s\S]*?\.innerBrandAligned \{[\s\S]*?container-type: inline-size/);
  assert.match(headerStyles, /@media \(min-width: 1181px\) and \(max-width: 1240px\)[\s\S]*?\.brandWorkingColumn \{[\s\S]*?translateX\(8px\)/);
  assert.match(headerStyles, /@media \(min-width: 1241px\)[\s\S]*?\.brandWorkingColumn \{[\s\S]*?translateX\(clamp\(0px, calc\(\(100cqi - 1240px\) \/ 2\), 60px\)\)/);
  assert.doesNotMatch(headerStyles, /100vw - 1228px/);
  assert.doesNotMatch(headerStyles, /\.brandWorkingColumn \{[^}]*position: absolute/);
  assert.match(styles, /@media \(forced-colors: active\)/);
});
