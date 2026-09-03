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
  assert.match(zoom, /ZOOM_MODE_STORAGE_KEY = 'aim4price\.site\.workspace-zoom-mode\.v1'/);
  assert.match(zoom, /MIN_ZOOM = 70/);
  assert.match(zoom, /MAX_ZOOM = 150/);
  assert.match(zoom, /ZOOM_STEP = 10/);
  assert.match(zoom, /localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(zoom, /localStorage\.setItem\(STORAGE_KEY, String\(zoom\)\)/);
  assert.match(zoom, /localStorage\.setItem\(ZOOM_MODE_STORAGE_KEY, zoomMode\)/);
  assert.match(zoom, /changeZoom\(zoom - ZOOM_STEP\)/);
  assert.match(zoom, /changeZoom\(zoom \+ ZOOM_STEP\)/);
  assert.match(zoom, /onClick=\{enableAutoZoom\}/);

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

test('page zoom is minimal, manual overrides stay stable and installable apps remain separate', async () => {
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

  assert.match(zoom, /zoomModeRef\.current = 'manual'/);
  assert.match(zoom, /setZoomMode\('manual'\)/);
  assert.match(zoom, /usesContainedScroll[\s\S]*?host\.scrollLeft = Math\.max\(0, desiredLeft\)/);
});

test('automatic display sizing uses one continuous browser-window curve without fighting Ctrl zoom', async () => {
  const [zoom, styles] = await Promise.all([
    read('components/SiteWorkspaceZoom.tsx'),
    read('components/SiteWorkspaceZoom.module.css'),
  ]);

  assert.match(zoom, /AUTO_BASE_WINDOW_WIDTH = 1440/);
  assert.match(zoom, /AUTO_MAX_WINDOW_WIDTH = 3840/);
  assert.match(zoom, /AUTO_MAX_ZOOM = 140/);
  assert.match(zoom, /const outerWidth = Number\(window\.outerWidth\)/);
  assert.match(zoom, /function calculateAutoZoom\(windowWidth: number\)/);
  assert.match(zoom, /windowWidth - AUTO_BASE_WINDOW_WIDTH/);
  assert.match(zoom, /AUTO_MAX_WINDOW_WIDTH - AUTO_BASE_WINDOW_WIDTH/);
  assert.match(zoom, /const easedProgress = Math\.sqrt\(progress\)/);
  assert.match(zoom, /DEFAULT_ZOOM \+ \(AUTO_MAX_ZOOM - DEFAULT_ZOOM\) \* easedProgress/);
  assert.doesNotMatch(zoom, /AUTO_DESKTOP_WINDOW_WIDTH|AUTO_LARGE_WINDOW_WIDTH|AUTO_ZOOM_STEP/);
  assert.doesNotMatch(zoom, /DisplayProfile|displayProfileForWidth|aim4priceDisplayProfile/);
  assert.doesNotMatch(styles, /data-aim4price-display-profile/);

  assert.match(zoom, /if \(savedZoomValue && savedZoom !== DEFAULT_ZOOM\)[\s\S]*?mode: 'manual'/);
  assert.match(zoom, /zoomModeRef\.current === 'auto'[\s\S]*?applyZoom\(calculateAutoZoom\(readWindowWidth\(\)\)\)/);
  assert.match(zoom, /window\.addEventListener\('resize', syncWindowSizing\)/);
  assert.match(zoom, /window\.addEventListener\('orientationchange', syncWindowSizing\)/);
  assert.match(zoom, /zoomModeRef\.current = 'auto'/);
  assert.match(zoom, /setZoomMode\('auto'\)/);
  assert.match(zoom, /data-zoom-preference=\{zoomMode\}/);
  assert.match(zoom, /Automatic page size \$\{zoom\} percent/);
  assert.match(zoom, /Page size adjusts automatically\. Use − or \+ if needed\./);
});

test('Home desktop geometry stays continuous across historical 1240, 1360 and short-height endpoints', async () => {
  const [styles, homeStyles] = await Promise.all([
    read('components/SiteWorkspaceZoom.module.css'),
    read('app/page.module.css'),
  ]);

  // Historical endpoint rules are still present in the mature Home stylesheet,
  // but the shared site shell now supersedes the geometry they used to change.
  assert.match(homeStyles, /@media \(min-width: 1181px\) and \(max-width: 1360px\) and \(min-height: 640px\)/);
  assert.match(homeStyles, /@media \(min-width: 1181px\) and \(max-width: 1240px\) and \(min-height: 640px\)/);
  assert.match(homeStyles, /@media \(min-width: 1181px\) and \(min-height: 640px\) and \(max-height: 759px\)/);

  assert.match(styles, /@media \(min-width: 1181px\) and \(min-height: 640px\)/);
  assert.match(styles, /--hero-working-inset: clamp\(0px, calc\(\(100% - 1240px\) \/ 2\), 60px\) !important/);
  assert.match(styles, /minmax\(clamp\(27rem, 31vw, 31rem\), 1fr\)/);
  assert.match(styles, /minmax\(clamp\(34rem, 43vw, 39rem\), 49\.5rem\) !important/);
  assert.match(styles, /gap: clamp\(3rem, 4\.5vw, 6rem\) !important/);
  assert.match(styles, /padding-block: clamp\(1rem, 3\.5vh, 3rem\) !important/);
  assert.match(styles, /calc\(\(100dvh - 5\.75rem\) \* 1\.25\)/);
  assert.match(styles, /--feature-copy-inset: clamp\(4\.75rem, calc\(12rem - 4vw\), 7\.75rem\) !important/);
  assert.match(styles, /width: min\(100%, clamp\(27rem, 27vw, 31rem\)\) !important/);
  assert.match(styles, /min-height: clamp\(18rem, 36vh, 22rem\) !important/);
  assert.match(styles, /font-size: clamp\(2\.4rem, min\(3\.45vw, 5\.4vh\), 4rem\) !important/);

  // Do not reintroduce monitor-specific layout tiers in the shared override.
  const continuityBlock = styles.slice(
    styles.indexOf('One continuous desktop Home composition.'),
    styles.indexOf('Keep the page-size control as a genuinely separate header tool.'),
  );
  assert.doesNotMatch(continuityBlock, /max-width:\s*1240px|max-width:\s*1360px|max-height:\s*759px/);
  assert.doesNotMatch(continuityBlock, /1600px|2200px|2560px/);
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

test('page-size controls live beside the header action rail and introduce themselves once on Home', async () => {
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
  assert.match(styles, /:has\(> \[data-site-workspace-zoom-controls\]\)[\s\S]*?> :first-child[\s\S]*?width: max-content !important/);
  assert.match(styles, /div:has\(> \[aria-label='Open manage menu'\]\)[\s\S]*?flex: 0 0 10\.25rem !important/);
  assert.match(styles, /\[aria-label='Open manage menu'\][\s\S]*?box-sizing: border-box !important[\s\S]*?width: 100% !important/);

  assert.match(styles, /\.controlsIntro \{[\s\S]*?animation: pageZoomControlIntro/);
  assert.match(styles, /@keyframes pageZoomControlIntro[\s\S]*?transform: scale\(1\.12\)/);
  assert.match(zoom, /pathname !== '\/'[\s\S]*?hasSeenIntro\(\)/);
  assert.match(zoom, /Page size adjusts automatically\. Use − or \+ if needed\./);
  assert.match(zoom, /aria-label="Aim4price page size controls"/);
  assert.match(zoom, /aria-label="Zoom out"[\s\S]*?data-tooltip="Zoom out"/);
  assert.match(zoom, /aria-label="Zoom in"[\s\S]*?data-tooltip="Zoom in"/);
  assert.match(styles, /\.zoomButton::after \{[\s\S]*?content: attr\(data-tooltip\)[\s\S]*?background: #124c3c/);
  assert.match(styles, /\.zoomButton:hover:not\(:disabled\)::after,[\s\S]*?\.zoomButton:focus-visible::after[\s\S]*?visibility: visible/);
  assert.match(zoom, /setShowIntro\(false\)[\s\S]*?zoomModeRef\.current = 'manual'[\s\S]*?applyZoom\(nextZoom\)/);
});
