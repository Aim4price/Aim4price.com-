import assert from 'node:assert/strict';
import test from 'node:test';
import { access } from 'node:fs/promises';
import { websiteCanvas } from './helpers/site-layout-audit.mjs';
const {
  WEBSITE_SCALE_STEP,
  WEBSITE_PHONE_SHORT_SIDE_MAX,
  WEBSITE_LANDSCAPE_BYPASS_KEY,
  stepWebsiteScale,
  WEBSITE_DESIGN_WIDTH,
  calculateWebsiteScale,
  clampManualWebsiteScale,
  parseWebsitePreference,
  isNativeWorkspace,
  shouldSuggestWebsiteLandscape,
} = websiteCanvas;
import { read, root, websiteStylesheets, assertNoWebsiteReflow, postcss } from './helpers/site-layout-audit.mjs';

test('one canonical width drives continuous downscaling and capped upscaling', () => {
  assert.equal(WEBSITE_DESIGN_WIDTH, 1440);
  for (const width of [430, 768, 1024, 1280, 1366, 1440, 1600]) assert.equal(calculateWebsiteScale(width), width / WEBSITE_DESIGN_WIDTH);
  for (const width of [1920, 3840]) assert.equal(calculateWebsiteScale(width), 1.2);
  for (const boundary of [760, 900, 1180, 1240, 1360]) assert.ok(Math.abs(calculateWebsiteScale(boundary + 1) - calculateWebsiteScale(boundary)) < .001);
  for (const invalid of [0, -1, NaN, Infinity]) assert.equal(calculateWebsiteScale(invalid), 1);
});
test('manual preferences use a clean versioned contract and retain the current automatic starting scale', async () => {
  for (const saved of [null, 'corrupt', '{"mode":"other"}']) assert.deepEqual(parseWebsitePreference(saved), { mode: 'auto' });
  assert.deepEqual(parseWebsitePreference('{"mode":"manual","scale":0.8}'), { mode: 'manual', scale: .8 });
  assert.equal(clampManualWebsiteScale(0), .15);
  assert.equal(clampManualWebsiteScale(3), 1.5);
  const starting = calculateWebsiteScale(430);
  assert.equal(clampManualWebsiteScale(starting + .1), starting + .1);
  const host = await read('components/SiteWorkspaceZoom.tsx');
  assert.match(host, /stepWebsiteScale\(current.mode === 'manual' \? current.scale : automaticScale, delta\)/);
  assert.match(host, /localStorage\.setItem\(WEBSITE_PREFERENCE_KEY, JSON\.stringify\(preference\)\)/);
  assert.match(host, /setPreference\(\{ mode: 'auto' \}\)/);
  assert.doesNotMatch(host, /workspace-zoom\.v1|workspace-zoom-mode\.v1/);
});
test('header, pages, background, footer and overlays share one canvas independently of header discovery', async () => {
  const [layout, host, css] = await Promise.all([read('app/layout.tsx'), read('components/SiteWorkspaceZoom.tsx'), read('components/SiteWorkspaceZoom.module.css')]);
  assert.match(layout, /<SiteWorkspaceZoom footer=\{<AppFooter \/>\} operational=\{<AdminWorkTrackerBar \/>\}>[\s\S]*?<AppPatternBackground>\{children\}<\/AppPatternBackground>/);
  assert.match(host, /width: WEBSITE_DESIGN_WIDTH,[\s\S]*zoom: scale/);
  assert.match(host, /data-website-canvas data-website-scale=\{scale\}>[\s\S]*?\{children\}[\s\S]*?\{footer\}[\s\S]*?id=\{WEBSITE_OVERLAY_ROOT_ID\}/);
  assert.match(host, /WebsiteCanvasContext\.Provider value=\{true\}/);
  assert.doesNotMatch(css, /\bzoom\s*:|overflow-x:\s*hidden|overflow-y:\s*scroll/);
  assert.doesNotMatch(host, /header\.dataset|host\.dataset|isAvailable|siteZoomMode/);
  for (const file of ['compact-desktop-continuity.css', 'header-manage-tuning.css']) {
    await assert.rejects(access(`${root}/app/${file}`));
    assert.ok(!layout.includes(file));
  }
});
test('Auto uses browser width without cancelling native zoom or adding height tiers', async () => {
  const host = await read('components/SiteWorkspaceZoom.tsx');
  const reader = host.slice(host.indexOf('function availableUnzoomedWidth'), host.indexOf('export default'));
  assert.match(reader, /window\.outerWidth/);
  assert.doesNotMatch(reader, /innerHeight|outerHeight|devicePixelRatio|matchMedia/);
  assert.match(host, /height \/ scale/);
  assert.doesNotMatch(await read('app/layout.tsx'), /userScalable:\s*false|maximumScale|minimumScale|width:\s*980/);
});
test('native product and operational routes are excluded with exact path boundaries', () => {
  for (const prefix of ['/owner-app', '/dealer', '/field-manager', '/admin', '/scan', '/fuel-scan']) {
    assert.equal(isNativeWorkspace(prefix), true);
    assert.equal(isNativeWorkspace(`${prefix}/nested/page`), true);
  }
  for (const route of ['/', '/account', '/dealer-costs', '/asset-register', '/account/owner-app', '/scan-help']) assert.equal(isNativeWorkspace(route), false);
});
test('portrait phone entry strongly recommends landscape without locking orientation', async () => {
  assert.equal(WEBSITE_PHONE_SHORT_SIDE_MAX, 560);
  assert.equal(WEBSITE_LANDSCAPE_BYPASS_KEY, 'aim4price.website-landscape-entry.v1');

  for (const [width, height] of [[320, 568], [390, 844], [430, 932], [540, 960]]) {
    assert.equal(shouldSuggestWebsiteLandscape(width, height, true), true);
    assert.equal(shouldSuggestWebsiteLandscape(height, width, true), false);
  }
  assert.equal(shouldSuggestWebsiteLandscape(430, 932, false), false);
  assert.equal(shouldSuggestWebsiteLandscape(600, 960, true), false);
  assert.equal(shouldSuggestWebsiteLandscape(768, 1024, true), false);
  assert.equal(shouldSuggestWebsiteLandscape(1440, 900, true), false);
  for (const invalid of [[0, 900], [430, 0], [NaN, 900], [430, Infinity]]) {
    assert.equal(shouldSuggestWebsiteLandscape(invalid[0], invalid[1], true), false);
  }

  const [host, css] = await Promise.all([
    read('components/SiteWorkspaceZoom.tsx'),
    read('components/SiteWorkspaceZoom.module.css'),
  ]);
  assert.match(host, /matchMedia\('\(hover: none\) and \(pointer: coarse\)'\)/);
  assert.match(host, /sessionStorage\.getItem\(WEBSITE_LANDSCAPE_BYPASS_KEY\) === 'portrait'/);
  assert.match(host, /sessionStorage\.setItem\(WEBSITE_LANDSCAPE_BYPASS_KEY, 'portrait'\)/);
  assert.match(host, /window\.addEventListener\('orientationchange', syncLandscapeEntry\)/);
  assert.match(host, /viewport\?\.addEventListener\('resize', syncLandscapeEntry\)/);
  assert.match(host, /canvas\?\.setAttribute\('inert', ''\)/);
  assert.match(host, /data-mobile-landscape-entry/);
  assert.match(host, /document\.body/);
  assert.match(host, /Turn your phone sideways/);
  assert.match(host, /Continue in portrait/);
  assert.doesNotMatch(host, /screen\.orientation\.lock|requestFullscreen/);
  assert.match(css, /\.landscapeGate\s*\{[\s\S]*position:\s*fixed;[\s\S]*inset:\s*0;/);
  assert.match(css, /prefers-reduced-motion:[\s]*reduce[\s\S]*\.landscapePhone/);
});
test('all website stylesheet imports are guarded against viewport-driven reflow', async () => {
  const stylesheets = await websiteStylesheets();
  assert.ok(stylesheets.length >= 60);
  for (const file of stylesheets) assertNoWebsiteReflow(await read(file), file);
  const home = await read('app/page.module.css');
  assert.doesNotMatch(home, /@media[^\{]*(?:width|height)\s*:/);
  assert.match(home, /prefers-reduced-motion/);
  postcss.parse(await read('components/SiteWorkspaceZoom.module.css')).walkRules(rule => {
    if (rule.selector.includes('.zoomValue')) rule.walkDecls('display', declaration => assert.notEqual(declaration.value, 'none'));
  });
});
test('website portals resolve after mount while native and explicit targets keep their hosts', async () => {
  const portal = await read('components/WebsitePortal.tsx');
  assert.match(portal, /isWebsite && target === document\.body/);
  assert.match(portal, /useLayoutEffect\([\s\S]*?websiteOverlayRoot\(\)/);
  assert.match(portal, /if \(!usesWebsiteRoot\) return reactCreatePortal\(children, target, portalKey\)/);
  assert.match(portal, /host \? reactCreatePortal\(children, host, portalKey\) : null/);
  const dropdown = await read('components/DropdownOverlay.tsx');
  assert.match(dropdown, /websiteLogicalRect\(anchor\.getBoundingClientRect\(\)\)/);
  assert.match(dropdown, /websiteVisibleViewport\(\)/);
  assert.match(dropdown, /menuElement, schedulePositionUpdate/);
  assert.match(dropdown, /aim4price:canvas-geometry/);
});

test('website visual viewport units resolve through canonical variables', async () => {
  for (const file of await websiteStylesheets()) {
    const css = postcss.parse(await read(file));
    css.walkDecls(declaration => {
      const selector = declaration.parent.selector || '';
      if (selector.includes(':not(:has([data-website-canvas]))')) return;
      const value = declaration.value.replace(/var\(--website-[\w-]+,\s*[^)]+\)/g, '');
      if (!/\d(?:dvw|vw|dvh|vh|svh|svw|vmin|vmax)\b/.test(value)) return;
      // Native global token defaults are overridden on the canvas itself.
      if (selector === ':root' && ['--layout-section-gap', '--layout-card-gap'].includes(declaration.prop)) {
        let canonicalOverride = false;
        css.walkDecls(declaration.prop, candidate => {
          if (candidate.parent.selector?.includes('[data-website-canvas]') && candidate.value.includes('--website-design-vw')) canonicalOverride = true;
        });
        assert.ok(canonicalOverride, `${file}: ${declaration.prop} needs a canonical override`);
        return;
      }
      assert.fail(`${file}: ${selector} ${declaration.prop} uses physical viewport sizing: ${declaration.value}`);
    });
  }
});


test('zoom moves by one displayed percentage point without drift and stops at limits', () => {
  assert.equal(WEBSITE_SCALE_STEP, .01);
  for (let percentage = 15; percentage <= 150; percentage++) {
    assert.equal(stepWebsiteScale(percentage / 100, WEBSITE_SCALE_STEP), Math.min(150, percentage + 1) / 100);
    assert.equal(stepWebsiteScale(percentage / 100, -WEBSITE_SCALE_STEP), Math.max(15, percentage - 1) / 100);
  }
  assert.equal(stepWebsiteScale(calculateWebsiteScale(1530), WEBSITE_SCALE_STEP), 1.07);
  assert.equal(stepWebsiteScale(calculateWebsiteScale(1530), -WEBSITE_SCALE_STEP), 1.05);
});
