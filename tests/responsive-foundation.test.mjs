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

test('header keeps the complete desktop navigation on the fixed mobile canvas', async () => {
  const [header, headerClient, layout] = await Promise.all([
    read('components/AppHeader.module.css'),
    read('components/AppHeader.tsx'),
    read('app/layout.tsx'),
  ]);

  assert.match(header, /Responsive shell contract, August 2026/);
  assert.match(header, /@media \(min-width: 761px\) and \(max-width: 1180px\)[\s\S]*?\.nav \{[\s\S]*?display: grid;[\s\S]*?\.navRail \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(header, /@media \(min-width: 761px\) and \(max-width: 1180px\)[\s\S]*?\.mobileMenuButton,[\s\S]*?\.mobileMenuPanel \{[\s\S]*?display: none/);
  assert.match(headerClient, /usesCompactHeader[\s\S]*?navItems\.length/);
  assert.match(layout, /width: 980/);
  assert.match(layout, /initialScale: -1/);
  assert.doesNotMatch(layout, /width: 'device-width'|initialScale: 1/);
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
  assert.match(header, /@media \(max-width: 760px\)[\s\S]*?\.mobileMenuButton \{[\s\S]*?display: none;[\s\S]*?\.accountMenu \{[\s\S]*?display: block/);
  assert.match(headerClient, /!isLoadingSession && !session \? styles\.innerPublic/);
  assert.match(header, /@media \(max-width: 760px\)[\s\S]*?\.innerPublic \.actionsRail \{[\s\S]*?grid-template-columns: minmax\(3\.5rem, 0\.72fr\) minmax\(7rem, 1\.28fr\)/);
  assert.match(header, /\.innerPublic \.loginButton,[\s\S]*?\.innerPublic \.signupButton \{[\s\S]*?min-height: var\(--tap-target-min, 44px\)/);
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

test('home page keeps the eight-step story usable at desktop, compact and reduced-motion sizes', async () => {
  const [home, hero] = await Promise.all([
    read('app/page.module.css'),
    read('app/home-hero-experience.tsx'),
  ]);
  const storyStart = home.indexOf(
    '/* === Timed and scroll-led Aim4price homepage story, September 2026 === */',
  );
  const story = home.slice(storyStart);

  assert.ok(storyStart >= 0);
  assert.match(home, /Living Asset Record homepage hero, September 2026/);
  assert.match(hero, /HERO_STAGES: readonly QuestionKey\[\]/);
  assert.match(hero, /HERO_STORY_STEPS = \[[\s\S]*?'brand',[\s\S]*?'promise',[\s\S]*?'preview',[\s\S]*?\.\.\.HERO_STAGES/);
  assert.match(hero, /HERO_FEATURE_DURATION_MS = 4800/);
  assert.match(hero, /window\.matchMedia\(REDUCED_MOTION_QUERY\)/);
  assert.match(hero, /window\.matchMedia\(DESKTOP_STORY_QUERY\)/);
  assert.match(hero, /DESKTOP_STORY_QUERY = '\(min-width: 1181px\) and \(min-height: 640px\)'/);
  assert.match(hero, /desktopStoryMedia\.matches && !reducedMotionMedia\.matches/);
  assert.match(hero, /finishAutoplay[\s\S]*?updateStoryStep\(0\)/);
  assert.match(hero, /const timer = window\.setTimeout\(\(\) => \{[\s\S]*?if \(autoplayFinishedRef\.current\) return/);
  assert.match(hero, /href="#choose-role"[\s\S]*?className=\{styles\.primaryCta\}[\s\S]*?onClick=\{handleRoleSkip\}/);
  assert.doesNotMatch(hero, /heroAudienceCta|heroSectors/);
  assert.doesNotMatch(hero, /handlePlaybackToggle|onPlaybackToggle|playbackId|key=\{playbackId\}/);
  assert.match(hero, /new IntersectionObserver\([\s\S]*?setIsHeroVisible\(entry\?\.isIntersecting \?\? true\)/);
  assert.match(hero, /window\.addEventListener\('scroll', handleScroll, \{ passive: true \}\)/);
  assert.match(hero, /window\.removeEventListener\('scroll', handleScroll\)/);
  assert.match(hero, /trackTravel = Math\.max\([\s\S]*?section\.offsetHeight - sticky\.offsetHeight/);
  assert.match(hero, /localScroll = Math\.max\([\s\S]*?Math\.min\(trackTravel, currentScrollY - trackStart\)/);
  assert.match(hero, /nextIndex = clampStoryIndex\([\s\S]*?Math\.floor\(progress \* HERO_STORY_STEPS\.length\)/);
  assert.match(hero, /const handleScroll = \(\) => scheduleStorySync\(true\)/);
  assert.match(hero, /const scheduleStorySync = \(claimControl: boolean\) => \{[\s\S]*?if \(claimControl\) autoplayFinishedRef\.current = true/);
  assert.match(hero, /window\.addEventListener\('resize', handleResize\)/);
  assert.match(hero, /window\.addEventListener\('pageshow', handlePageShow\)/);
  const nativeScrollFlow = hero.slice(
    hero.indexOf('const scheduleStorySync = (claimControl: boolean)'),
    hero.indexOf('const storyGrid = storyGridRef.current'),
  );
  assert.doesNotMatch(nativeScrollFlow, /scrollIntoView|scrollTo\(|preventDefault|addEventListener\(['"](?:wheel|touchmove)/);
  assert.doesNotMatch(hero, /PROMISE_STEP_INDEX|HERO_STORY_SCROLL_RATIO|data-story-complete|isStoryComplete|completeStory|scrollAnchorRef|lastScrollYRef|storyHeightPx|setStoryHeightPx|scrollIntoView/);

  const desktop = story.slice(
    story.indexOf('@media (min-width: 1181px) and (min-height: 640px)'),
    story.indexOf('@media (min-width: 1181px) and (max-width: 1360px)'),
  );
  assert.match(desktop, /\.heroStory \{[\s\S]*?440svh/);
  assert.doesNotMatch(story, /--hero-story-height|data-story-complete/);
  assert.match(desktop, /\.heroSticky \{[\s\S]*?position: sticky;[\s\S]*?height: calc\(100dvh - 5\.75rem\)/);
  assert.match(desktop, /\.heroStory \.heroMedia\.heroSticky \{[\s\S]*?height: calc\(100dvh - 5\.75rem\)/);
  assert.doesNotMatch(desktop, /\.heroStory \.heroMedia \{[^}]*height: 100%/s);
  assert.match(story, /\.heroStory \.heroMedia \.shell \{[\s\S]*?width: min\(calc\(100% - 3rem\), 1360px\)/);
  assert.doesNotMatch(story, /\.heroStory \.heroMedia \.shell \{[^}]*100rem/s);
  assert.match(desktop, /\.storyHeroGrid \{[\s\S]*?--hero-working-inset: clamp\(0px, calc\(\(100% - 1240px\) \/ 2\), 60px\);[\s\S]*?width: calc\(100% - var\(--hero-working-inset\)\);[\s\S]*?height: 100%;[\s\S]*?grid-template-columns: minmax\(31rem, 1fr\) minmax\(39rem, 49\.5rem\);[\s\S]*?margin-inline-start: var\(--hero-working-inset\)/);
  assert.match(desktop, /\.assetStageMotion \{[\s\S]*?--asset-preview-center-inset: 2\.325rem;[\s\S]*?width: min\(45\.5rem, calc\(100% \+ 7rem\)\);[\s\S]*?justify-self: end/);
  assert.match(desktop, /\.heroStory \.assetQuestionGroup,[\s\S]*?\.heroStory \.assetPreviewCard \{[\s\S]*?top: var\(--asset-preview-center-inset\);[\s\S]*?bottom: var\(--asset-preview-center-inset\)/);
  assert.match(story, /@media \(min-width: 1181px\) and \(max-width: 1360px\) and \(min-height: 640px\)[\s\S]*?\.storyHeroGrid \{[\s\S]*?grid-template-columns: minmax\(27rem, 31rem\) minmax\(34rem, 44rem\)/);
  assert.match(story, /@media \(min-width: 1181px\) and \(max-width: 1360px\) and \(min-height: 640px\)[\s\S]*?\.assetStageMotion \{[\s\S]*?width: min\(44rem, calc\(100% \+ 6rem\)\)/);
  assert.match(story, /@media \(min-width: 1181px\) and \(max-width: 1240px\) and \(min-height: 640px\)[\s\S]*?--hero-working-inset: 8px/);
  assert.match(story, /@media \(min-width: 1181px\) and \(min-height: 640px\) and \(max-height: 759px\)[\s\S]*?\.assetStageMotion \{[\s\S]*?width: min\(43rem, calc\(100% \+ 5rem\)\)/);
  assert.match(story, /\.featureNarrativeCount \{[\s\S]*?top: 0\.35rem;[\s\S]*?bottom: auto/);
  assert.match(story, /\.heroPromiseTitle \{[\s\S]*?font-size: clamp\(2\.65rem, 2\.95vw, 2\.95rem\)/);
  assert.doesNotMatch(story, /data-autoplay-finished='true'[^{]*\.storyHeroLogo/);

  const compact = story.slice(
    story.indexOf('@media (max-width: 1180px), (max-height: 639px)'),
    story.indexOf('@media (max-width: 760px)'),
  );
  assert.match(compact, /\.heroStory \{[\s\S]*?min-height: 0 !important/);
  assert.match(compact, /\.heroSticky \{[\s\S]*?position: relative;[\s\S]*?height: auto/);
  assert.match(compact, /\.storyHeroGrid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(compact, /\.heroBrandCopy \{[\s\S]*?opacity: 1;[\s\S]*?filter: none/);
  assert.match(compact, /\.heroPromiseCopy \{[\s\S]*?display: none/);
  assert.match(compact, /\.storyHeroLogo \{[\s\S]*?order: 2;[\s\S]*?opacity: 1/);
  assert.match(compact, /\.assetStageMotion \{[\s\S]*?order: 3;[\s\S]*?opacity: 1;[\s\S]*?transform: none !important/);
  assert.match(compact, /\.featureNarrative \{[\s\S]*?order: 4;[\s\S]*?opacity: 1/);
  assert.match(compact, /\.compactHeroActions \{[\s\S]*?display: flex;[\s\S]*?order: 5/);
  assert.match(compact, /\.storyPauseControl \{[\s\S]*?display: none/);

  assert.match(story, /@media \(max-width: 760px\)[\s\S]*?\.compactHeroActions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(story, /@media \(max-width: 640px\)[\s\S]*?\.compactHeroActions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(home, /@media \(max-width: 640px\)[\s\S]*?\.roleGrid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);

  assert.match(home, /\.assetQuestion:focus-visible \{[\s\S]*?outline: 3px solid/);
  assert.match(home, /\.primaryCta,[\s\S]*?\.secondaryCta \{[\s\S]*?min-height: 3\.2rem/);
  assert.match(story, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.storyCopyLayer,[\s\S]*?animation: none !important;[\s\S]*?transition: none !important/);
  assert.match(story, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.storyCopyLayer,[\s\S]*?filter: none !important/);
  assert.match(story, /@media \(prefers-reduced-motion: reduce\) and \(min-width: 1181px\)[\s\S]*?\.heroBrandCopy \{[\s\S]*?opacity: 1;[\s\S]*?\.compactHeroActions \{[\s\S]*?display: flex/);
  assert.match(story, /@media \(prefers-reduced-motion: reduce\) and \(min-width: 1181px\)[\s\S]*?\.heroStory \.heroMedia\.heroSticky \{[\s\S]*?height: auto;[\s\S]*?overflow: hidden/);
  assert.doesNotMatch(story, /scroll-snap|overscroll-behavior/);
  assert.match(home, /@media \(forced-colors: active\)/);
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
