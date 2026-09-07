import { assertNoWebsiteReflow, typescript } from './helpers/site-layout-audit.mjs';
import { WEBSITE_DESIGN_WIDTH } from '../lib/website-canvas.ts';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('global layout tokens provide fluid gutters, spacing and stable text scaling', async () => {
  const globals = await read('app/globals.css');

  assert.match(globals, /--shell-width: min\(calc\(100% - \(var\(--shell-gutter\) \* 2\)\), var\(--shell-max\)\)/);
  assert.match(globals, /--layout-section-gap: clamp\(/);
  assert.match(globals, /--layout-card-gap: clamp\(/);
  assert.match(globals, /--control-min-height: 44px/);
  assert.match(globals, /-webkit-text-size-adjust: 100%/);
  assert.match(globals, /\.appRoot,[\s\S]*?\.appRoot > main,[\s\S]*?main \{[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%/);
});

test('website header keeps desktop navigation while native callers retain compact behavior', async () => {
  const header = await read('components/AppHeader.tsx');
  assert.match(header, /useContext\(WebsiteCanvasContext\)/);
  assert.match(header, /if \(isCanonicalWebsite\) \{\s*setUsesCompactHeader\(false\);\s*return;/);
  assert.match(header, /window\.matchMedia\('\(max-width: 760px\)'\)/);
  assert.match(header, /NAV_WINDOW_SIZE/);
  assert.match(header, /label: 'Get Estimate'/);
  assert.match(header, /aria-label="Open manage menu"/);
  assert.match(header, /notificationBadgeText/);
  assertNoWebsiteReflow(await read('components/AppHeader.module.css'), 'AppHeader');
});

test('website sign-out stays separate from installable app sessions and verifies closure', async () => {
  const [headerClient, sessionCache, meRoute] = await Promise.all([
    read('components/AppHeader.tsx'),
    read('lib/header-session-cache.ts'),
    read('app/api/me/route.ts'),
  ]);

  assert.match(sessionCache, /fetch\('\/api\/me\?scope=website'/);
  assert.match(meRoute, /export async function GET\(request: Request\)/);
  assert.match(meRoute, /searchParams\.get\('scope'\) === 'website'/);
  assert.match(meRoute, /websiteOnly[\s\S]*?\? await getServerSession\(\)[\s\S]*?: await getServerSession\(\{ allowDealerApp: true, allowOwnerApp: true \}\)/);
  assert.match(headerClient, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(headerClient, /keepalive: true/);
  assert.match(headerClient, /fetch\('\/api\/me\?scope=website'/);
  assert.match(headerClient, /verification\?\.signedIn !== false/);
  assert.match(headerClient, /clearCachedHeaderSession\(\)[\s\S]*?window\.location\.replace\('\/auth#login'\)/);
});

test('Home retains its eight-step scroll story at every width and respects reduced motion', async () => {
  const [home, hero] = await Promise.all([read('app/page.module.css'), read('app/home-hero-experience.tsx')]);
  assert.match(hero, /HERO_STORY_STEPS = \[[\s\S]*?'brand',[\s\S]*?'promise',[\s\S]*?'preview',[\s\S]*?\.\.\.HERO_STAGES/);
  assert.match(hero, /HERO_FEATURE_DURATION_MS = 4800/);
  assert.match(hero, /supportsStory = !reducedMotionMedia\.matches/);
  assert.doesNotMatch(hero, /DESKTOP_STORY_QUERY|desktopStoryMedia/);
  assert.match(hero, /sectionRect\.height - stickyRect\.height/);
  assert.match(hero, /getComputedStyle\(sticky\)\.top[\s\S]*?currentWebsiteScale\(\)/);
  assert.match(hero, /window\.addEventListener\('scroll', handleScroll, \{ passive: true \}\)/);
  assert.match(hero, /aim4price:canvas-geometry/);
  assert.match(hero, /finishAutoplay[\s\S]*?updateStoryStep\(0\)/);
  assert.match(hero, /Math\.floor\(progress \* HERO_STORY_STEPS\.length\)/);
  assert.match(home, /grid-template-columns: minmax\(446\.4px, 1fr\) minmax\(619\.2px, 49\.5rem\)/);
  assert.match(home, /prefers-reduced-motion/);
  assert.match(home, /forced-colors/);
  assertNoWebsiteReflow(home, 'Home');
});

test('Asset Register keeps desktop cards and controls while retaining native app rules', async () => {
  const register = await read('app/asset-register/page.module.css');
  assertNoWebsiteReflow(register, 'Asset Register');
  assert.match(register, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(register, /--website-visible-height/);
  assert.match(register, /overscroll-behavior: contain/);
  const source = await read('app/asset-register/asset-register-client.tsx');
  const parsed = typescript.createSourceFile('register.tsx', source, typescript.ScriptTarget.Latest, true, typescript.ScriptKind.TSX);
  const declaration = parsed.statements.find(node => typescript.isFunctionDeclaration(node) && node.name?.text === 'getRegisterSummaryCardsPerView');
  const compiled = typescript.transpileModule(declaration.getText(parsed), { compilerOptions: { target: typescript.ScriptTarget.ES2022 } }).outputText;
  const getCount = new Function('window', 'document', 'WEBSITE_DESIGN_WIDTH', 'REGISTER_SUMMARY_VISIBLE_CARD_COUNT', compiled + '; return getRegisterSummaryCardsPerView();');
  for (const width of [430, 768, 1024, 1440, 1920]) assert.equal(getCount({ innerWidth: width }, { querySelector: () => ({}) }, WEBSITE_DESIGN_WIDTH, 3), 3);
  assert.equal(getCount({ innerWidth: 430 }, { querySelector: () => null }, WEBSITE_DESIGN_WIDTH, 3), 1);
});

test('Owner and Field Manager apps use fluid tablet gutters without adding desktop behavior', async () => {
  const [owner, field] = await Promise.all([
    read('app/owner-app/owner-app.module.css'),
    read('app/field-manager/page.module.css'),
  ]);

  assert.match(owner, /@media \(min-width: 600px\) and \(max-width: 960px\)[\s\S]*?--owner-page-gutter: clamp\(32px, 6vw, 48px\)/);
  assert.match(owner, /\.assetsHeaderPair \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(owner, /\.managerAssetList,[\s\S]*?\.notificationList \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);

  assert.match(field, /@media \(min-width: 600px\) and \(max-width: 960px\)[\s\S]*?--field-page-gutter: clamp\(32px, 6vw, 48px\)/);
  assert.match(field, /\.homeActionGrid,[\s\S]*?\.overviewList \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(field, /Responsive field manager desktop/);
});

test('account access labels remain single-line but cannot overflow narrow tiles', async () => {
  const access = await read('app/account/app-access-management.module.css');

  assert.match(access, /\.launcherIntro p \{[\s\S]*?white-space: nowrap;[\s\S]*?overflow: hidden;[\s\S]*?text-overflow: ellipsis/);
  assert.match(access, /\.actionCopy small \{[\s\S]*?white-space: nowrap;[\s\S]*?overflow: hidden;[\s\S]*?text-overflow: ellipsis/);
  assert.match(access, /@media \(max-width: 640px\)[\s\S]*?\.actionCopy strong \{[\s\S]*?white-space: nowrap/);
});

