import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Asset Register keeps the global header outside a zoomable stable workspace', async () => {
  const [page, frame, styles] = await Promise.all([
    read('app/asset-register/page.tsx'),
    read('app/asset-register/asset-register-workspace-frame.tsx'),
    read('app/asset-register/asset-register-workspace-frame.module.css'),
  ]);

  assert.match(page, /import AppHeader from "\.\.\/\.\.\/components\/AppHeader"/);
  assert.match(page, /import AssetRegisterWorkspaceFrame from "\.\/asset-register-workspace-frame"/);
  assert.match(
    page,
    /<AppHeader active="asset-register" brandAlignment="working-column" \/>[\s\S]*?<AssetRegisterWorkspaceFrame>\{children\}<\/AssetRegisterWorkspaceFrame>/,
  );
  assert.match(page, /<AssetRegisterClient[\s\S]*?showAppHeader=\{false\}/);

  assert.match(frame, /MIN_ZOOM = 70/);
  assert.match(frame, /MAX_ZOOM = 150/);
  assert.match(frame, /ZOOM_STEP = 10/);
  assert.match(frame, /WORKSPACE_BASE_WIDTH = 1180/);
  assert.match(frame, /localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(frame, /localStorage\.setItem\(STORAGE_KEY, String\(zoom\)\)/);
  assert.match(frame, /changeZoom\(zoom - ZOOM_STEP\)/);
  assert.match(frame, /changeZoom\(zoom \+ ZOOM_STEP\)/);
  assert.match(frame, /changeZoom\(DEFAULT_ZOOM\)/);
  assert.match(frame, /Fit width/);
  assert.match(frame, /previousCenter[\s\S]*?viewport\.scrollLeft = Math\.max\(0, desiredLeft\)/);

  assert.match(styles, /\.viewport \{[\s\S]*?overflow-x: auto/);
  assert.match(styles, /\.canvas \{[\s\S]*?width: max\(100%, 1180px\);[\s\S]*?min-width: 1180px/);
  assert.match(styles, /zoom: var\(--asset-register-workspace-zoom\)/);
  assert.match(styles, /\.canvas > main \{[\s\S]*?min-width: 1180px/);
});

test('custom workspace zoom does not use viewport breakpoints as its scaling mechanism', async () => {
  const [frame, styles] = await Promise.all([
    read('app/asset-register/asset-register-workspace-frame.tsx'),
    read('app/asset-register/asset-register-workspace-frame.module.css'),
  ]);

  assert.doesNotMatch(frame, /matchMedia|innerWidth|devicePixelRatio|screen\.width/);
  assert.doesNotMatch(styles, /transform:\s*scale\(/);
  assert.match(frame, /data-workspace-zoom=\{zoom\}/);
  assert.match(styles, /\.viewport \{/);
});
