import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('normal Aim4price website pages share one persistent user-controlled zoom layer', async () => {
  const [layout, zoom, styles, header] = await Promise.all([
    read('app/layout.tsx'),
    read('components/SiteWorkspaceZoom.tsx'),
    read('components/SiteWorkspaceZoom.module.css'),
    read('components/AppHeader.tsx'),
  ]);

  assert.match(layout, /import SiteWorkspaceZoom from '\.\.\/components\/SiteWorkspaceZoom'/);
  assert.match(
    layout,
    /<SiteWorkspaceZoom>[\s\S]*?<AppPatternBackground>\{children\}<\/AppPatternBackground>[\s\S]*?<\/SiteWorkspaceZoom>/,
  );

  assert.match(zoom, /STORAGE_KEY = 'aim4price\.site\.workspace-zoom\.v1'/);
  assert.match(zoom, /MIN_ZOOM = 70/);
  assert.match(zoom, /MAX_ZOOM = 150/);
  assert.match(zoom, /ZOOM_STEP = 10/);
  assert.match(zoom, /localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(zoom, /localStorage\.setItem\(STORAGE_KEY, String\(zoom\)\)/);
  assert.match(zoom, /changeZoom\(zoom - ZOOM_STEP\)/);
  assert.match(zoom, /changeZoom\(zoom \+ ZOOM_STEP\)/);
  assert.match(zoom, /changeZoom\(DEFAULT_ZOOM\)/);

  assert.match(header, /aria-label="Go to Aim4price home"/);
  assert.match(zoom, /querySelector<HTMLAnchorElement>\('a\[aria-label="Go to Aim4price home"\]'\)/);
  assert.match(zoom, /header\.dataset\.aim4priceAppHeader = 'true'/);
  assert.match(zoom, /host\.dataset\.aim4priceSiteZoomHost = 'true'/);
  assert.match(zoom, /--aim4price-site-workspace-zoom/);

  assert.match(styles, /data-aim4price-site-zoom-mode='workspace'[\s\S]*?overflow-x: auto !important/);
  assert.match(
    styles,
    /data-aim4price-site-zoom-host='true'\] > \[data-aim4price-app-header='true'\] ~ \*[\s\S]*?zoom: var\(--aim4price-site-workspace-zoom, 1\)/,
  );
});

test('page zoom is minimal, does not trigger responsive breakpoints and leaves installable apps alone', async () => {
  const [zoom, styles] = await Promise.all([
    read('components/SiteWorkspaceZoom.tsx'),
    read('components/SiteWorkspaceZoom.module.css'),
  ]);

  assert.match(zoom, /EXCLUDED_ROUTE_PREFIXES = \['\/owner-app', '\/dealer', '\/field-manager', '\/admin'\]/);
  assert.match(zoom, /pathname === prefix \|\| pathname\.startsWith\(`\$\{prefix\}\/`\)/);
  assert.doesNotMatch(zoom, /matchMedia|devicePixelRatio|screen\.width|innerWidth/);

  const pageZoomRule = styles.match(
    /data-aim4price-site-zoom-host='true'\] > \[data-aim4price-app-header='true'\] ~ \*[\s\S]*?\}/,
  )?.[0] ?? '';
  assert.match(pageZoomRule, /zoom: var\(--aim4price-site-workspace-zoom, 1\)/);
  assert.doesNotMatch(pageZoomRule, /transform:\s*scale\(/);

  assert.match(styles, /\.zoomButton,[\s\S]*?\.zoomValue \{[\s\S]*?border: 0;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none/);
  const controlsBlock = styles.slice(styles.indexOf('.controls {'), styles.indexOf('.zoomButton,'));
  assert.doesNotMatch(controlsBlock, /position:\s*fixed/);
  assert.doesNotMatch(controlsBlock, /border:|background:|box-shadow:/);

  assert.match(zoom, /usesContainedScroll[\s\S]*?host\.scrollLeft = Math\.max\(0, desiredLeft\)/);
});

test('Home keeps window scrolling and measures its story in rendered zoomed coordinates', async () => {
  const [zoom, styles, homeStory, homeStyles] = await Promise.all([
    read('components/SiteWorkspaceZoom.tsx'),
    read('components/SiteWorkspaceZoom.module.css'),
    read('app/home-hero-experience.tsx'),
    read('app/page.module.css'),
  ]);

  assert.match(zoom, /type SiteZoomMode = 'workspace' \| 'viewport'/);
  assert.match(zoom, /return pathname === '\/' \? 'viewport' : 'workspace'/);
  assert.match(zoom, /host\.dataset\.aim4priceSiteZoomMode = siteZoomMode\(pathname\)/);
  assert.match(zoom, /delete host\.dataset\.aim4priceSiteZoomMode/);

  assert.match(
    styles,
    /data-aim4price-site-zoom-mode='viewport'[\s\S]*?overflow: visible !important[\s\S]*?scrollbar-gutter: auto/,
  );
  assert.doesNotMatch(
    styles.match(/data-aim4price-site-zoom-mode='viewport'[\s\S]*?\}/)?.[0] ?? '',
    /overflow-x:\s*auto/,
  );

  assert.match(homeStory, /const currentScrollY = window\.scrollY/);
  assert.match(homeStory, /const sectionRect = section\.getBoundingClientRect\(\)/);
  assert.match(homeStory, /const stickyRect = sticky\.getBoundingClientRect\(\)/);
  assert.match(homeStory, /sectionRect\.height - stickyRect\.height/);
  assert.doesNotMatch(homeStory, /section\.offsetHeight - sticky\.offsetHeight/);
  assert.match(homeStory, /window\.addEventListener\('scroll', handleScroll/);

  const desktopStory = homeStyles.slice(homeStyles.indexOf('@media (min-width: 1181px) and (min-height: 640px)'));
  assert.match(desktopStory, /\.heroSticky \{[\s\S]*?position: sticky;[\s\S]*?top: 5\.75rem/);
  assert.match(desktopStory, /\.heroStory \{[\s\S]*?min-height: 440svh/);
});

test('page-size controls live in the header and introduce themselves once on Home', async () => {
  const [zoom, styles] = await Promise.all([
    read('components/SiteWorkspaceZoom.tsx'),
    read('components/SiteWorkspaceZoom.module.css'),
  ]);

  assert.match(zoom, /import \{ createPortal \} from 'react-dom'/);
  assert.match(zoom, /INTRO_STORAGE_KEY = 'aim4price\.site\.workspace-zoom-intro\.v1'/);
  assert.match(zoom, /const headerInner = header\?\.firstElementChild/);
  assert.match(zoom, /const headerActions = headerInner\?\.lastElementChild/);
  assert.match(zoom, /controlHostRef\.current = headerActions/);
  assert.match(zoom, /setControlHost\(headerActions\)/);
  assert.match(zoom, /createPortal\(controls, controlHost\)/);
  assert.doesNotMatch(zoom, /document\.createElement\('span'\)|aim4priceSiteZoomSlot|appendChild\(/);

  const headerControlsRule = styles.match(/\.controls \{[\s\S]*?\}/)?.[0] ?? '';
  assert.match(headerControlsRule, /display: inline-flex/);
  assert.match(headerControlsRule, /min-width:/);
  assert.match(headerControlsRule, /margin-left:/);
  assert.match(styles, /\.controlsIntro \{[\s\S]*?animation: pageZoomControlIntro/);
  assert.match(styles, /@keyframes pageZoomControlIntro[\s\S]*?transform: scale\(1\.12\)/);
  assert.match(zoom, /pathname !== '\/'[\s\S]*?hasSeenIntro\(\)/);
  assert.match(zoom, /Increase or decrease page size here\./);
  assert.match(zoom, /aria-label="Aim4price page size controls"/);
  assert.match(zoom, /aria-label="Decrease page size"/);
  assert.match(zoom, /aria-label="Increase page size"/);
  assert.match(zoom, /setShowIntro\(false\)[\s\S]*?zoomRef\.current = normalizedZoom/);
});
