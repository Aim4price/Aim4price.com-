import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Home uses one mandatory standard canvas on desktop, tablet and mobile', async () => {
  const [page, check, checkStyles, header, headerStyles, pageStyles] = await Promise.all([
    read('app/page.tsx'),
    read('app/home-display-check.tsx'),
    read('app/home-display-check.module.css'),
    read('components/AppHeader.tsx'),
    read('components/AppHeader.module.css'),
    read('app/page.module.css'),
  ]);

  assert.match(page, /<HomeDisplayCheck>[\s\S]*?<AppHeader[\s\S]*?standardCanvas[\s\S]*?<HomeHeroExperience \/>[\s\S]*?<HomeRoleSelector \/>[\s\S]*?<\/HomeDisplayCheck>/);
  assert.match(check, /data-home-standard-canvas="true"/);
  assert.match(checkStyles, /\.homeContent \{[\s\S]*?width: 1360px;[\s\S]*?min-width: 1360px;[\s\S]*?zoom: var\(--aim4price-site-scale\)/);
  assert.match(checkStyles, /\.canvasPositioner \{[\s\S]*?--aim4price-scaled-canvas-width/);
  assert.match(pageStyles, /One calibrated standard Home canvas/);
  assert.match(pageStyles, /\.page\[data-home-standard-canvas='true'\] \.storyHeroGrid/);
  assert.match(pageStyles, /\.page\[data-home-standard-canvas='true'\] \.roleGrid/);
  assert.doesNotMatch(check, /DISPLAY_CHECK_QUERY|desktopMedia|DISPLAY_SIZES|data-home-display-size/);
  assert.doesNotMatch(pageStyles, /data-home-display-size='small'|data-home-display-size='compact'/);

  assert.match(header, /standardCanvas\?: boolean/);
  assert.match(header, /standardCanvas \? styles\.headerStandardCanvas/);
  assert.match(headerStyles, /\.headerStandardCanvas \.nav,[\s\S]*?display: flex/);
  assert.match(headerStyles, /\.headerStandardCanvas \.mobileMenuButton,[\s\S]*?display: none/);
  assert.doesNotMatch(headerStyles, /data-home-display-size/);
});

test('the display check applies one numeric whole-page scale instead of style presets', async () => {
  const [check, checkStyles, pageStyles] = await Promise.all([
    read('app/home-display-check.tsx'),
    read('app/home-display-check.module.css'),
    read('app/page.module.css'),
  ]);

  assert.match(check, /STANDARD_CANVAS_WIDTH = 1360/);
  assert.match(check, /MIN_SITE_SCALE = 0\.15/);
  assert.match(check, /MAX_SITE_SCALE = 1\.15/);
  assert.match(check, /SITE_SCALE_STEP = 0\.05/);
  assert.match(check, /getRecommendedScale/);
  assert.match(check, /setSiteScale\(\(current\) =>[\s\S]*?direction \* SITE_SCALE_STEP/);
  assert.match(check, /'--aim4price-site-scale': String\(siteScale\)/);
  assert.match(check, /'--aim4price-scaled-canvas-width': `\$\{STANDARD_CANVAS_WIDTH \* siteScale\}px`/);
  assert.match(check, /'--aim4price-canvas-height'/);
  assert.match(check, /'--aim4price-story-height'/);
  assert.match(check, /\{Math\.round\(siteScale \* 100\)\}%/);
  assert.match(check, /Zoom the complete Aim4price page out/);
  assert.match(check, /Zoom the complete Aim4price page in/);
  assert.match(checkStyles, /zoom: var\(--aim4price-site-scale\)/);
  assert.doesNotMatch(pageStyles, /data-home-display-size/);
});

test('the required check keeps its security language truthful and cannot be skipped', async () => {
  const [check, styles, hero] = await Promise.all([
    read('app/home-display-check.tsx'),
    read('app/home-display-check.module.css'),
    read('app/home-hero-experience.tsx'),
  ]);

  assert.match(check, /window\.location\.protocol === 'https:' && window\.isSecureContext/);
  assert.match(check, /'localhost', '127\.0\.0\.1', '::1'/);
  assert.match(check, /Display fit required/);
  assert.match(check, /Scale the complete Aim4price page to fit, then continue\./);
  assert.match(check, /Secure connection required/);
  assert.match(check, /Required before entering Aim4price\./);
  assert.match(check, /role="dialog"/);
  assert.match(check, /aria-modal="true"/);
  assert.match(check, /const \[isGateOpen, setIsGateOpen\] = useState\(true\)/);
  assert.match(check, /content\.setAttribute\('inert', ''\)/);
  assert.match(check, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(check, /if \(event\.key === 'Escape'\)[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)/);
  assert.match(check, /disabled=\{!isSecure \|\| !doesPreviewFit\}/);
  assert.match(check, /const handleContinue = \(\) => \{[\s\S]*?completeDisplayCheck\(siteScale\)/);
  const recommendedHandler = check.slice(
    check.indexOf('const selectRecommendedScale = () => {'),
    check.indexOf('const handleContinue = () => {'),
  );
  assert.doesNotMatch(recommendedHandler, /completeDisplayCheck/);
  assert.match(check, /document\.getElementById\('home-hero-title'\)\?\.focus\(\)/);
  assert.match(styles, /\.canvasPositioner\[data-display-ready='false'\],[\s\S]*?visibility: hidden;[\s\S]*?pointer-events: none/);
  assert.match(hero, /useHomeDisplayReady\(\)/);
  assert.match(hero, /!isHomeDisplayReady/);
});

test('fit is measured on both axes and revalidated when a display changes', async () => {
  const check = await read('app/home-display-check.tsx');

  assert.match(check, /getBoundingClientRect\(\)/);
  assert.match(check, /preview\.left >= frame\.left \+ safeInset/);
  assert.match(check, /preview\.top >= frame\.top \+ safeInset/);
  assert.match(check, /preview\.right <= frame\.right - safeInset/);
  assert.match(check, /preview\.bottom <= frame\.bottom - safeInset/);
  assert.match(check, /doesScaleFitViewport/);
  assert.match(check, /hasDisplayMateriallyChanged/);
  assert.match(check, /window\.screen\?\.width/);
  assert.match(check, /window\.devicePixelRatio/);
  assert.match(check, /relativeDifference\(previous\.width, current\.width\) > 0\.08/);
  assert.match(check, /relativeDifference\(previous\.pixelRatio, current\.pixelRatio\) > 0\.08/);
  assert.match(check, /new ResizeObserver\(scheduleViewportSync\)/);
  assert.match(check, /window\.addEventListener\('resize', scheduleViewportSync/);
  assert.match(check, /window\.addEventListener\('orientationchange', scheduleViewportSync\)/);
  assert.match(check, /window\.addEventListener\('pageshow', scheduleViewportSync\)/);
  assert.match(check, /window\.addEventListener\('focus', scheduleViewportSync\)/);
  assert.match(check, /window\.screen\?\.orientation\?\.addEventListener/);
  assert.match(check, /openRequiredCheck\(nextSignature\)/);
});

test('a completed fit is stored per display state and old preset preferences are retired', async () => {
  const check = await read('app/home-display-check.tsx');

  assert.match(check, /DISPLAY_COMPLETED_KEY = 'aim4price:home-display-check:completed:v3'/);
  assert.match(check, /DISPLAY_PREFERENCE_KEY = 'aim4price:home-display-preference:v4'/);
  assert.match(check, /version: DISPLAY_PREFERENCE_VERSION,[\s\S]*?scale: normalizeSiteScale\(selectedScale\),[\s\S]*?viewport: nextSignature/);
  assert.match(check, /window\.localStorage/);
  assert.match(check, /window\.sessionStorage/);
  assert.match(check, /persistDisplayCompletion\(preference\)/);
  assert.match(check, /hasCompletedCheckRef\.current = true/);
  assert.match(check, /aim4price:home-display-preference:v3/);
  assert.match(check, /aim4price:home-display-preference:v2/);
  assert.match(check, /window\.addEventListener\('storage', syncCapability\)/);
  assert.doesNotMatch(check, /selections: Partial<Record|\[profile\]: selectedSize/);
});

test('the fit dialog remains usable on narrow phone screens', async () => {
  const styles = await read('app/home-display-check.module.css');

  assert.match(styles, /@media \(max-width: 600px\)/);
  assert.match(styles, /\.backdrop \{[\s\S]*?overflow-y: auto/);
  assert.match(styles, /\.dialog \{[\s\S]*?width: 100%;[\s\S]*?max-height: none/);
  assert.match(styles, /\.dialogFooter > div \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.recommendedButton,[\s\S]*?\.continueButton \{[\s\S]*?width: 100%/);
});
