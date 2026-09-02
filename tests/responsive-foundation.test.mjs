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

test('header has deterministic desktop, tablet and true-mobile navigation states', async () => {
  const [header, headerClient, layout] = await Promise.all([
    read('components/AppHeader.module.css'),
    read('components/AppHeader.tsx'),
    read('app/layout.tsx'),
  ]);

  assert.match(header, /Responsive shell contract, September 2026/);
  assert.match(header, /@media \(min-width: 761px\) and \(max-width: 1180px\)[\s\S]*?\.nav \{[\s\S]*?display: grid;[\s\S]*?\.navRail \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(header, /@media \(min-width: 761px\) and \(max-width: 1180px\)[\s\S]*?\.mobileMenuButton,[\s\S]*?\.mobileMenuPanel \{[\s\S]*?display: none/);
  assert.match(header, /\.navWindowed \{[\s\S]*?grid-template-columns: var\(--tap-target-min, 44px\) minmax\(0, 1fr\) var\(--tap-target-min, 44px\)/);
  assert.match(header, /\.navStatic \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(headerClient, /showNavWindowControls \? styles\.navWindowed : styles\.navStatic/);
  assert.match(headerClient, /usesCompactHeader[\s\S]*?navItems\.length/);
  assert.match(layout, /width: 'device-width'/);
  assert.match(layout, /initialScale: 1/);
  assert.match(layout, /userScalable: true/);
  assert.match(layout, /viewportFit: 'cover'/);
  assert.doesNotMatch(layout, /width:\s*980|initialScale:\s*-1/);
  assert.match(headerClient, /window\.matchMedia\('\(max-width: 760px\)'\)/);
  assert.doesNotMatch(headerClient, /max-device-width/);
  assert.match(headerClient, /usesCompactHeader \? styles\.innerCompact/);
  assert.match(headerClient, /usesCompactHeader \? styles\.navCompact/);
  assert.match(headerClient, /\{ key: 'home', href: '\/', label: 'Home' \}/);
  assert.match(headerClient, /\{ key: 'valuation', href: '\/valuation', label: 'Get Estimate' \}/);
  assert.match(header, /\.innerCompact \{[\s\S]*?grid-template-areas: "brand actions";[\s\S]*?row-gap: 0/);
  assert.match(header, /\.navCompact \{[\s\S]*?display: none/);
  assert.doesNotMatch(header, /@media \(hover: none\) and \(pointer: coarse\) and \(max-device-width: 900px\)/);
  assert.doesNotMatch(header, /navSwipe/);
  assert.match(header, /@media \(max-width: 760px\)[\s\S]*?\.nav \{[\s\S]*?display: none;[\s\S]*?\.mobileMenuButton \{[\s\S]*?display: inline-flex/);
  assert.match(header, /@media \(max-width: 760px\)[\s\S]*?\.mobileMenuBackdrop \{[\s\S]*?display: block;[\s\S]*?\.mobileMenuPanel \{[\s\S]*?display: grid/);
  assert.match(headerClient, /!isLoadingSession && !session \? styles\.innerPublic/);
  assert.match(header, /@media \(max-width: 760px\)[\s\S]*?\.actionsRail,[\s\S]*?\.innerPublic \.actionsRail \{[\s\S]*?display: flex/);
  assert.match(header, /\.innerPublic \.signupButton,[\s\S]*?\.actionDivider \{[\s\S]*?display: none/);
  assert.match(headerClient, /className=\{styles\.mobileMenuPanel\}[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(headerClient, /mobileMenuAuthLinkPrimary[\s\S]*?\{ctaLabel\}/);
  assert.match(header, /\.navWindowButton \{[\s\S]*?min-width: var\(--tap-target-min, 44px\)/);
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

test('home page uses one fluid layout contract instead of a calibrated fixed canvas', async () => {
  const [page, home, hero] = await Promise.all([
    read('app/page.tsx'),
    read('app/page.module.css'),
    read('app/home-hero-experience.tsx'),
  ]);

  const storyStart = home.indexOf('/* Responsive Home story.');
  const story = home.slice(storyStart);

  assert.ok(storyStart >= 0);
  assert.match(page, /<main className={styles\.page}>/);
  assert.match(page, /<AppHeader active="home" brandAlignment="working-column" \/>/);
  assert.doesNotMatch(page, /HomeDisplayCheck|standardCanvas|displayScale/);

  assert.match(home, /--home-shell-max: 1360px/);
  assert.match(home, /--home-gutter: 1\.5rem/);
  assert.match(home, /\.shell \{[\s\S]*?width: min\([\s\S]*?calc\(100% - \(var\(--home-gutter\) \* 2\)\),[\s\S]*?var\(--home-shell-max\)/);
  assert.doesNotMatch(home, /zoom:\s*var\(|min-width:\s*1360px|--asset-stage-shift-x/);
  assert.doesNotMatch(story, /inset-inline-start:\s*calc\(0rem -|width:\s*min\([^;]*calc\(100% \+/);

  assert.match(hero, /HERO_STORY_STEPS = \[[\s\S]*?'brand',[\s\S]*?'promise',[\s\S]*?'preview',[\s\S]*?\.\.\.HERO_STAGES/);
  assert.match(hero, /HERO_FEATURE_DURATION_MS = 4800/);
  assert.match(hero, /\(min-width: 1181px\) and \(min-height: 700px\) and \(hover: hover\) and \(pointer: fine\)/);
  assert.match(hero, /cinematicStoryMedia\.matches && !reducedMotionMedia\.matches/);
  assert.match(hero, /finishAutoplay[\s\S]*?updateStoryStep\(0\)/);
  assert.match(hero, /new IntersectionObserver\([\s\S]*?setIsHeroVisible\(entry\?\.isIntersecting \?\? true\)/);
  assert.match(hero, /window\.addEventListener\('scroll', handleScroll, \{ passive: true \}\)/);
  assert.match(hero, /trackTravel = Math\.max\([\s\S]*?section\.offsetHeight - sticky\.offsetHeight/);
  assert.match(hero, /nextIndex = clampStoryIndex\([\s\S]*?Math\.floor\(progress \* HERO_STORY_STEPS\.length\)/);
  assert.match(hero, /new ResizeObserver\(syncHeaderHeight\)/);
  assert.match(hero, /--home-header-height/);
  assert.doesNotMatch(hero, /storyGridRef|assetMotionRef|offsetLeft|--asset-stage-shift-x/);

  const scrollFlow = hero.slice(
    hero.indexOf('const scheduleStorySync = (claimControl: boolean)'),
    hero.indexOf('const handleQuestionChange'),
  );
  assert.doesNotMatch(scrollFlow, /scrollIntoView|scrollTo\(|preventDefault|addEventListener\(['"](?:wheel|touchmove)/);
  assert.doesNotMatch(hero, /scroll-snap|overscroll-behavior/);

  assert.match(story, /\.storyHeroGrid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(story, /\.assetStageMotion \.assetHeroStage \{[\s\S]*?display: grid;[\s\S]*?aspect-ratio: auto/);
  assert.match(story, /@media \(min-width: 960px\)[\s\S]*?grid-template-columns: minmax\(0, 1\.22fr\) minmax\(18rem, 0\.78fr\)/);
  assert.match(story, /@media \(min-width: 761px\) and \(max-width: 959px\)[\s\S]*?\.assetStageMotion \{[\s\S]*?grid-column: 1 \/ -1;[\s\S]*?\.featureNarrative \{[\s\S]*?grid-column: 1 \/ -1/);

  const cinematic = story.slice(
    story.indexOf('@media (min-width: 1181px) and (min-height: 700px)'),
    story.indexOf('@keyframes assetStageToPreview'),
  );
  assert.match(cinematic, /and \(hover: hover\) and \(pointer: fine\)/);
  assert.match(cinematic, /\.heroStory \{[\s\S]*?min-height: 500svh/);
  assert.match(cinematic, /\.heroSticky \{[\s\S]*?position: sticky;[\s\S]*?height: calc\(100dvh - var\(--home-header-height, 5\.75rem\)\);[\s\S]*?overflow: hidden/);
  assert.match(cinematic, /data-story-mode='features'[\s\S]*?\.storyHeroGrid \{[\s\S]*?grid-template-columns: minmax\(34rem, 1\.16fr\) minmax\(22rem, 0\.84fr\)/);
  assert.match(cinematic, /data-story-mode='features'[\s\S]*?\.assetStageMotion \{[\s\S]*?grid-column: 1/);
  assert.match(cinematic, /\.featureNarrative \{[\s\S]*?grid-column: 2/);
  assert.match(cinematic, /filter: blur\(14px\)[\s\S]*?opacity 820ms[\s\S]*?filter 820ms/);

  assert.match(story, /@media \(max-width: 760px\)[\s\S]*?--home-gutter: 1rem/);
  assert.match(story, /@media \(max-width: 760px\)[\s\S]*?\.assetQuestionGroup \{[\s\S]*?grid-template-rows: minmax\(3\.5rem, auto\)/);
  assert.match(story, /@media \(max-width: 760px\)[\s\S]*?\.compactHeroActions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(story, /@media \(max-width: 520px\)[\s\S]*?\.compactHeroActions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(story, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important;[\s\S]*?transition: none !important/);
  assert.match(home, /@media \(forced-colors: active\)/);
  assert.match(home, /@media \(max-width: 760px\)[\s\S]*?\.roleGrid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
});

test('asset register has deterministic toolbar, card-action and modal device states', async () => {
  const register = await read('app/asset-register/page.module.css');

  assert.match(register, /Responsive foundation contract, August 2026/);
  assert.match(register, /@media \(max-width: 1040px\)[\s\S]*?\.page \.toolbarActions \{[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(min\(9\.5rem, 100%\), 1fr\)\)/);
  assert.match(register, /@media \(max-width: 900px\)[\s\S]*?\.page \.assetHeader \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) clamp\(9\.25rem, 28vw, 11rem\)/);
  assert.match(register, /@media \(max-width: 900px\)[\s\S]*?\.page \.assetGroupHeader \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) clamp\(9\.25rem, 28vw, 11rem\)/);
  assert.match(register, /@media \(max-width: 900px\)[\s\S]*?\.page \.assetHeaderActions,[\s\S]*?\.page \.assetGroupHeaderActions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(register, /@media \(max-width: 760px\)[\s\S]*?min-height: var\(--tap-target-min, 44px\)/);
  assert.match(register, /@media \(max-width: 560px\)[\s\S]*?\.page \.toolbarActions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(register, /max-height: calc\(100dvh - 1rem\) !important/);
  assert.match(register, /overscroll-behavior: contain/);
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
